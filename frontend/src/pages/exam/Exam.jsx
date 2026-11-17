import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Clock3,
  ShieldCheck,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Send,
  Camera,
  AlertTriangle,
  RotateCcw,
  Mic,
  Maximize2,
  Minimize2,
  Check,
  X,
  Volume2,
  HelpCircle,
  Eye,
  Award,
  Layers,
  ChevronRight,
  Filter,
  Trophy,
  Timer,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import Brand from "../../components/Brand";
import { Loading } from "../../components/Layouts";
import QuestionRenderer from "../../components/QuestionRenderer";
import { ProctoringEngine } from "../../lib/proctoringEngine";
import {
  getExamScheduleInfo,
  formatDateTime,
  formatExamWindow,
  formatCountdown,
} from "../../services/schedulingService";
import "./Exam.css";

const formatTimer = (s) => {
  const safe = Math.max(0, Number(s) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function Exam() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, token } = useAuth();

  // Core Exam & State Data
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [isUnregistered, setIsUnregistered] = useState(false);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState([]);
  const [visited, setVisited] = useState([0]); // Track visited question indices
  const [idx, setIdx] = useState(0);
  const [seconds, setSeconds] = useState(7200); // 2 hours default
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState("Auto-saved");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pre-exam hardware verification states
  const [cameraStatus, setCameraStatus] = useState("pending"); // "pending" | "active" | "denied" | "simulated"
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [isEnablingCamera, setIsEnablingCamera] = useState(false);

  const [micStatus, setMicStatus] = useState("pending"); // "pending" | "active" | "denied" | "simulated"
  const [micStream, setMicStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState("");
  const [isEnablingMic, setIsEnablingMic] = useState(false);

  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  const [starting, setStarting] = useState(false);

  // Proctoring States
  const [warningCount, setWarningCount] = useState(0);
  const [activeWarning, setActiveWarning] = useState(null);
  const [isFlagged, setIsFlagged] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [countdownData, setCountdownData] = useState(null);
  const [reviewFilter, setReviewFilter] = useState("all");

  const [proctoringStats, setProctoringStats] = useState({
    cameraStatus: "Connected",
    aiStatus: "Active",
    faceStatus: "Candidate Face Verified",
    micStatus: "Active",
    audioMonitoringStatus: "Normal"
  });

  // DOM Refs
  const preflightVideoRef = useRef(null);
  const liveVideoRef = useRef(null);
  const proctoringEngineRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioMeterCleanupRef = useRef(null);
  const dataRef = useRef({ answers, marked, visited });
  const currentAttempt = useRef(null);

  dataRef.current = { answers, marked, visited };

  // Calculate Sections (e.g. Physics, Chemistry, Mathematics, Biology)
  const sections = useMemo(() => {
    const map = {};
    questions.forEach((q) => {
      const subj = q.subject || "General";
      map[subj] = (map[subj] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [questions]);

  const currentSection = questions[idx]?.subject || (sections[0]?.name ?? "General");

  // Load examination metadata & questions
  useEffect(() => {
    let active = true;
    Promise.all([
      api(`/exams/${id}`),
      api(`/questions?examId=${id}`),
      api("/me/dashboard").catch(() => null)
    ])
      .then(([examData, qData, dashData]) => {
        if (!active) return;
        setExam(examData.exam);
        const qList = qData.questions || [];
        setQuestions(qList);

        if (examData.exam?.duration) {
          setSeconds(examData.exam.duration * 60);
        }

        const canonicalExamId = examData?.exam?.id || id;

        // Verify that candidate has registered for this examination
        const registrations = dashData?.registrations || [];
        const isRegistered = registrations.some(
          (r) => r.examId === canonicalExamId || r.examId === id
        );
        if (!isRegistered) {
          setIsUnregistered(true);
          return;
        }

        if (dashData?.attempts) {
          const prevAttempt = dashData.attempts.find((a) => a.examId === canonicalExamId || a.examId === id);
          if (prevAttempt) {
            if (prevAttempt.status === "in_progress") {
              setAttempt(prevAttempt);
              currentAttempt.current = prevAttempt;
              setAnswers(prevAttempt.answers || {});
              setMarked(prevAttempt.marked || []);
              if (prevAttempt.deadlineAt) {
                const remaining = Math.max(0, Math.floor((new Date(prevAttempt.deadlineAt).getTime() - Date.now()) / 1000));
                setSeconds(remaining);
              }
            } else if (prevAttempt.status === "submitted" || prevAttempt.status === "TERMINATED" || prevAttempt.status === "AUTO_SUBMITTED") {
              setAttempt(prevAttempt);
              setResult(prevAttempt);
            }
          }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });

    return () => {
      active = false;
    };
  }, [id]);

  // Request Camera Stream
  const handleEnableCamera = async () => {
    setIsEnablingCamera(true);
    setCameraError("");
    try {
      const stream = await ProctoringEngine.requestCameraStream();
      setCameraStream(stream);
      cameraStreamRef.current = stream;
      setCameraStatus("active");

      if (preflightVideoRef.current) {
        preflightVideoRef.current.srcObject = stream;
        preflightVideoRef.current.muted = true;
        await preflightVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera request error:", err);
      setCameraStatus("denied");
      setCameraError("Camera permission was not granted or hardware was not found.");
    } finally {
      setIsEnablingCamera(false);
    }
  };

  // Enable Demo / Simulated Camera & Mic if physical hardware unavailable
  const handleEnableSimulation = () => {
    try {
      // Create a canvas stream with an animated test pattern
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");

      let frame = 0;
      const drawSimulatedCam = () => {
        frame++;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, 640, 480);
        
        // Face outline simulation
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(320, 220 + Math.sin(frame * 0.05) * 5, 110, 150, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PROCTORED CANDIDATE (DEMO SIMULATION)", 320, 420);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#10b981";
        ctx.fillText("● AI Face Tracking Active", 320, 450);

        requestAnimationFrame(drawSimulatedCam);
      };
      drawSimulatedCam();

      const stream = canvas.captureStream(30);
      setCameraStream(stream);
      cameraStreamRef.current = stream;
      setCameraStatus("active");

      if (preflightVideoRef.current) {
        preflightVideoRef.current.srcObject = stream;
        preflightVideoRef.current.muted = true;
        preflightVideoRef.current.play().catch(() => {});
      }

      setMicStatus("active");
      setMicLevel(35);
      setCameraError("");
      setMicError("");
    } catch (e) {
      console.warn("Simulation fallback error:", e);
      setCameraStatus("active");
      setMicStatus("active");
    }
  };

  // Request Microphone Stream
  const handleEnableMicrophone = async () => {
    setIsEnablingMic(true);
    setMicError("");
    try {
      const stream = await ProctoringEngine.requestMicrophoneStream();
      setMicStream(stream);
      micStreamRef.current = stream;
      setMicStatus("active");

      if (audioMeterCleanupRef.current) audioMeterCleanupRef.current();
      audioMeterCleanupRef.current = ProctoringEngine.createAudioMeter(stream, (lvl) => setMicLevel(lvl));
    } catch (err) {
      console.warn("Mic access error:", err);
      setMicStatus("denied");
      setMicError("Microphone access was denied or hardware not detected.");
    } finally {
      setIsEnablingMic(false);
    }
  };

  // Cleanup media tracks on unmount
  useEffect(() => {
    return () => {
      if (audioMeterCleanupRef.current) audioMeterCleanupRef.current();
      if (!currentAttempt.current) {
        if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (proctoringEngineRef.current) {
        proctoringEngineRef.current.destroy();
        proctoringEngineRef.current = null;
      }
    };
  }, []);

  // Request / Toggle Fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch (e) {
        console.warn("Fullscreen request error:", e);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Start Examination
  const handleStartExam = async () => {
    if (starting) return;
    setStarting(true);
    setError("");

    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      const canonicalExamId = exam?.id || id;
      const res = await api("/attempts/start", {
        method: "POST",
        token,
        body: { examId: canonicalExamId }
      });

      if (res.alreadyFinished) {
        setAttempt(res.attempt);
        setResult(res.attempt);
        setError("This examination has already been completed. Each candidate is permitted only one attempt.");
        return;
      }

      setAttempt(res.attempt);
      currentAttempt.current = res.attempt;
      if (res.attempt?.answers) setAnswers(res.attempt.answers);
      if (res.attempt?.marked) setMarked(res.attempt.marked);
      setResult(null);
      setIsTerminated(false);

      if (res.attempt?.deadlineAt) {
        const left = Math.max(0, Math.floor((new Date(res.attempt.deadlineAt).getTime() - Date.now()) / 1000));
        setSeconds(left);
      }
    } catch (e) {
      setError(e.message || "Failed to start assessment.");
    } finally {
      setStarting(false);
    }
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (!attempt || result || isTerminated) return;

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt, result, isTerminated]);

  // Active Proctoring Violation Trigger & Auto-Termination Handler
  const triggerViolation = useCallback(async (eventType, description) => {
    if (!currentAttempt.current || isTerminated || result) return;
    const currentCount = (currentAttempt.current.warningCount || 0) + 1;
    currentAttempt.current.warningCount = currentCount;
    setWarningCount(currentCount);

    // Call API to persist warning and proctoring event
    try {
      await api("/proctoring/warning", {
        method: "POST",
        token,
        body: {
          attemptId: currentAttempt.current.id,
          examId: exam?.id || id,
          eventType,
          category: eventType,
          message: description
        }
      });
    } catch (e) {
      console.warn("Failed to report proctoring violation:", e);
    }

    if (currentCount >= 3) {
      // 3rd Warning: 3-second visual countdown before automatic termination
      setActiveWarning({
        count: 3,
        title: "Final Violation: Examination Terminated",
        message: "You have exceeded the maximum of 3 proctoring warnings. Your examination is now being automatically submitted.",
        countdown: 3
      });

      let cd = 3;
      const cdTimer = setInterval(async () => {
        cd -= 1;
        if (cd <= 0) {
          clearInterval(cdTimer);
          setIsTerminated(true);
          try {
            const res = await api("/attempts/terminate", {
              method: "POST",
              token,
              body: {
                attemptId: currentAttempt.current.id,
                answers: dataRef.current.answers,
                reason: `3_VIOLATIONS_REACHED (${eventType})`
              }
            });
            setResult(res);
            setActiveWarning(null);
            if (document.fullscreenElement && document.exitFullscreen) {
              document.exitFullscreen().catch(() => {});
            }
          } catch (err) {
            console.error("Termination error:", err);
          }
        } else {
          setActiveWarning((prev) => (prev ? { ...prev, countdown: cd } : null));
        }
      }, 1000);
    } else {
      setActiveWarning({
        count: currentCount,
        title: currentCount === 1 ? "Warning 1 of 3: Violation Recorded" : "Warning 2 of 3: Final Caution",
        message: description
      });
    }
  }, [exam, id, isTerminated, result, token]);

  // Active Browser & Proctoring Event Listeners
  useEffect(() => {
    if (!attempt || result || isTerminated) return;

    let debounceTimer = null;
    const debouncedTrigger = (type, desc) => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
      }, 2500); // Prevent duplicate events within 2.5 seconds
      triggerViolation(type, desc);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        debouncedTrigger("TAB_SWITCH", "Candidate switched away from the active examination browser tab.");
      }
    };

    const handleWindowBlur = () => {
      debouncedTrigger("WINDOW_BLUR", "Candidate window lost focus or application window was switched.");
    };

    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        debouncedTrigger("FULLSCREEN_EXIT", "Candidate exited full-screen examination workspace.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFsChange);

    // Stream track interruption listener
    if (cameraStreamRef.current) {
      const vTrack = cameraStreamRef.current.getVideoTracks()[0];
      if (vTrack) {
        vTrack.onended = () => {
          debouncedTrigger("CAMERA_INTERRUPTED", "Webcam video track interrupted or disconnected.");
        };
      }
    }

    if (micStreamRef.current) {
      const aTrack = micStreamRef.current.getAudioTracks()[0];
      if (aTrack) {
        aTrack.onended = () => {
          debouncedTrigger("MIC_INTERRUPTED", "Microphone audio track interrupted or disconnected.");
        };
      }
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, [attempt, result, isTerminated, triggerViolation]);

  // Answer selection handler
  const handleSelectAnswer = (optionIndex) => {
    if (!questions[idx]) return;
    const q = questions[idx];
    const qId = q.id;

    let updatedAns;
    if (q.questionType === "multiple_correct") {
      const current = Array.isArray(answers[qId]) ? [...answers[qId]] : [];
      const pos = current.indexOf(optionIndex);
      if (pos >= 0) {
        current.splice(pos, 1);
      } else {
        current.push(optionIndex);
      }
      updatedAns = current;
    } else {
      updatedAns = optionIndex;
    }

    const nextAnswers = { ...answers, [qId]: updatedAns };
    setAnswers(nextAnswers);

    // Auto-save attempt locally
    setSaving("Saving...");
    api("/attempts/save", {
      method: "POST",
      token,
      body: {
        attemptId: attempt?.id,
        answers: nextAnswers,
        marked,
        visited: Array.from(new Set([...visited, idx]))
      }
    })
      .then(() => setSaving("Auto-saved"))
      .catch(() => setSaving("Saved locally"));
  };

  // Mark / Unmark for Review
  const handleToggleMark = () => {
    if (!questions[idx]) return;
    const qId = questions[idx].id;
    let nextMarked;
    if (marked.includes(qId)) {
      nextMarked = marked.filter((m) => m !== qId);
    } else {
      nextMarked = [...marked, qId];
    }
    setMarked(nextMarked);

    api("/attempts/save", {
      method: "POST",
      token,
      body: {
        attemptId: attempt?.id,
        answers,
        marked: nextMarked,
        visited
      }
    });
  };

  // Clear current question response
  const handleClearResponse = () => {
    if (!questions[idx]) return;
    const qId = questions[idx].id;
    const nextAnswers = { ...answers };
    delete nextAnswers[qId];
    setAnswers(nextAnswers);

    api("/attempts/save", {
      method: "POST",
      token,
      body: {
        attemptId: attempt?.id,
        answers: nextAnswers,
        marked,
        visited
      }
    });
  };

  // Navigation: Jump to Question
  const handleJumpToQuestion = (targetIndex) => {
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setIdx(targetIndex);
    if (!visited.includes(targetIndex)) {
      setVisited((prev) => [...prev, targetIndex]);
    }
  };

  // Save & Next
  const handleSaveAndNext = () => {
    if (idx < questions.length - 1) {
      handleJumpToQuestion(idx + 1);
    } else {
      setConfirm(true);
    }
  };

  // Final Submission
  const handleSubmitExam = async () => {
    setConfirm(false);
    try {
      const res = await api("/attempts/submit", {
        method: "POST",
        token,
        body: {
          attemptId: attempt?.id,
          answers,
          marked,
          timeTaken: (exam?.duration ? exam.duration * 60 : 7200) - seconds
        }
      });
      setResult(res);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      setError(e.message || "Failed to submit exam.");
    }
  };

  // Palette Helper: Determine visual state for question at index i
  const getQuestionState = (item, i) => {
    const hasAns = answers[item.id] !== undefined && answers[item.id] !== null && answers[item.id] !== "";
    const isMarked = marked.includes(item.id);
    const hasVisited = visited.includes(i) || idx === i;

    if (hasAns && isMarked) return "answered-marked";
    if (hasAns) return "answered";
    if (isMarked) return "marked";
    if (hasVisited) return "not-answered";
    return "not-visited";
  };

  // Check if answer is present
  const isQuestionAnswered = (qId) => {
    const a = answers[qId];
    return a !== undefined && a !== null && a !== "" && (!Array.isArray(a) || a.length > 0);
  };

  const answeredCount = questions.filter((q) => isQuestionAnswered(q.id)).length;
  const markedCount = marked.length;
  const unansweredCount = questions.length - answeredCount;

  // -------------------------------------------------------------
  // RENDER: LOADING & ERROR STATES
  // -------------------------------------------------------------
  if (!exam && !error) {
    return (
      <div className="exam-loading-screen">
        <Loading />
        <p>Loading secure examination workspace...</p>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="exam-fatal-screen">
        <AlertCircle size={44} color="#ef4444" />
        <h2>Unable to load examination</h2>
        <p>{error}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
          <Link className="btn btn-soft" to="/student">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isUnregistered) {
    return (
      <div className="exam-fatal-screen" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", padding: 24 }}>
        <div className="panel" style={{ maxWidth: 540, width: "100%", textAlign: "center", padding: "48px 32px", borderRadius: 20, boxShadow: "0 20px 40px rgba(0,0,0,0.06)", background: "#fff" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#fef3c7", display: "grid", placeItems: "center", margin: "0 auto 20px", color: "#d97706" }}>
            <AlertCircle size={36} />
          </div>
          <span className="tag orange" style={{ marginBottom: 12 }}>REGISTRATION REQUIRED</span>
          <h2 style={{ fontSize: 24, margin: "10px 0 12px", color: "#0f172a" }}>
            {exam?.title || "Examination"}
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            You have not registered for this examination. Students must complete registration and wallet fee confirmation before attempting the assessment.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/student/browse" className="btn btn-primary">
              <BookOpen size={16} /> Browse Available Exams
            </Link>
            <Link to="/student/exams" className="btn btn-outline">
              My Registered Exams
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PRE-EXAMINATION SCHEDULE & TIMING CHECKS
  // -------------------------------------------------------------
  const schedule = getExamScheduleInfo(exam);

  // If exam has not started yet (Scheduled or Starting Soon)
  if (exam && !attempt && !result && (schedule.examStatus === "Scheduled" || schedule.examStatus === "Starting Soon")) {
    return (
      <div className="pre-exam-screen" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f8fafc" }}>
        <div className="panel" style={{ maxWidth: 540, textAlign: "center", padding: "40px 32px", borderRadius: 16 }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Timer size={36} />
          </div>
          <span className="tag orange" style={{ marginBottom: 12 }}>
            ● {schedule.examStatus === "Starting Soon" ? schedule.countdownText : "EXAMINATION SCHEDULED"}
          </span>
          <h2 style={{ fontSize: 24, margin: "10px 0 12px", color: "#0f172a" }}>
            {exam.title}
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            This examination is scheduled to begin on <strong>{formatDateTime(schedule.startsAt)}</strong>.
            Candidates cannot start earlier than the permitted opening time.
          </p>

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>
              Official Examination Window
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1e3a8a", marginTop: 4 }}>
              {formatExamWindow(schedule.startsAt, schedule.endsAt)}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>Duration: <strong>{exam.duration} Minutes</strong></span>
              <span>Total Marks: <strong>{exam.marks || 100}</strong></span>
              <span>Proctoring: <strong>{schedule.proctoringRequired ? "Required" : "Disabled"}</strong></span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/student/exams" className="btn btn-outline">
              Back to My Registered Exams
            </Link>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              <RotateCcw size={15} /> Refresh Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If exam window has already ended and student has not attempted it
  if (exam && !attempt && !result && schedule.isCompleted) {
    return (
      <div className="pre-exam-screen" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f8fafc" }}>
        <div className="panel" style={{ maxWidth: 540, textAlign: "center", padding: "40px 32px", borderRadius: 16 }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#f1f5f9", color: "#64748b", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Clock3 size={36} />
          </div>
          <span className="tag gray" style={{ marginBottom: 12 }}>EXAMINATION WINDOW EXPIRED</span>
          <h2 style={{ fontSize: 24, margin: "10px 0 12px", color: "#0f172a" }}>
            {exam.title}
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            The testing window for this examination closed on <strong>{formatDateTime(schedule.endsAt)}</strong>.
            New candidate attempts cannot be initiated.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/student/exams" className="btn btn-primary">
              Back to My Exams
            </Link>
            <Link to={`/student/leaderboard?examId=${exam.id}`} className="btn btn-outline">
              <Trophy size={15} /> View Final Leaderboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PRE-EXAMINATION HARDWARE VERIFICATION SCREEN
  // -------------------------------------------------------------
  const isProctoringActive = exam?.proctoringRequired !== false;

  if (!attempt && !result) {
    return (
      <div className="pre-exam-screen">
        <div className="pre-exam-container">
          <div className="pre-exam-header">
            <div>
              <div className="pre-exam-badge">
                <ShieldCheck size={16} /> Official Proctored Examination
              </div>
              <h1>{exam?.title || "Examination Verification"}</h1>
              <p className="pre-exam-sub">
                Candidate: <strong>{user?.name || "Student Candidate"}</strong> · Subject: {exam?.subject}
              </p>
            </div>
            <Brand compact />
          </div>

          <div className="pre-exam-grid">
            {/* Left: Instructions and Guidelines */}
            <div className="pre-exam-rules-card">
              <h3>Examination Specifications</h3>
              <div className="spec-chips">
                <span className="spec-chip">Duration: {exam?.duration || 180} Mins</span>
                <span className="spec-chip">Questions: {questions.length} Items</span>
                <span className="spec-chip">Total Marks: {exam?.marks || 300}</span>
                <span className="spec-chip">Marking: +4.0 / -1.0</span>
              </div>

              <h4>Important Candidate Instructions:</h4>
              <ul className="exam-rules-list">
                <li>This examination is conducted in a full-screen, proctored environment.</li>
                <li>Switching browser tabs or exiting full-screen mode will trigger a violation warning.</li>
                <li>Your answers are continuously synchronized and saved automatically.</li>
                <li>You can navigate freely between sections and questions using the question palette.</li>
                <li>The countdown timer at the top indicates time remaining; the test submits automatically upon expiry.</li>
              </ul>

              <div className="pre-exam-consent">
                <input
                  type="checkbox"
                  id="rules-check"
                  checked={rulesAcknowledged}
                  onChange={(e) => setRulesAcknowledged(e.target.checked)}
                />
                <label htmlFor="rules-check">
                  I have read, understood, and agree to abide by the examination rules and AI proctoring guidelines.
                </label>
              </div>
            </div>

            {/* Right: Camera and Hardware Setup */}
            <div className="pre-exam-hardware-card">
              <h3>System & Proctoring Verification</h3>
              <p className="hardware-desc">
                Separate hardware status checks ensure strict compliance during live assessment.
              </p>

              {/* Stack of 3 Hardware Status Indicator Tiles */}
              <div className="pre-exam-tiles-stack">
                {/* Tile 1: Camera Status */}
                <div className={`hardware-tile ${cameraStatus === "active" ? "active" : cameraStatus === "denied" ? "error" : "warning"}`}>
                  <div className="hardware-tile-head">
                    <div className="hardware-tile-title">
                      <Camera size={18} color={cameraStatus === "active" ? "#10b981" : "#2563eb"} />
                      <span>Webcam Verification</span>
                    </div>
                    <span className={`hardware-status-badge ${cameraStatus === "active" ? "verified" : cameraStatus === "denied" ? "denied" : "pending"}`}>
                      {cameraStatus === "active" ? "Verified" : cameraStatus === "denied" ? "Denied" : "Pending"}
                    </span>
                  </div>

                  <div className="preflight-cam-frame">
                    <video
                      ref={preflightVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="preflight-video"
                    />
                    {cameraStatus !== "active" && (
                      <div className="preflight-video-placeholder">
                        <Camera size={32} color="#94a3b8" />
                        <span>Webcam preview will appear here</span>
                      </div>
                    )}
                    <div className="preflight-watermark">
                      <span>{user?.name}</span>
                      <span className={cameraStatus === "active" ? "tag-live" : "tag-pending"}>
                        {cameraStatus === "active" ? "FEED VERIFIED" : "PENDING SETUP"}
                      </span>
                    </div>
                  </div>

                  {cameraError && (
                    <div className="hardware-error-pill" style={{ marginTop: 8 }}>
                      <AlertTriangle size={15} />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    {cameraStatus !== "active" ? (
                      <button
                        type="button"
                        className="btn btn-outline small"
                        style={{ width: "100%" }}
                        onClick={handleEnableCamera}
                        disabled={isEnablingCamera}
                      >
                        <Camera size={14} /> {isEnablingCamera ? "Connecting..." : "Enable Camera"}
                      </button>
                    ) : (
                      <div className="hardware-ok-pill">
                        <CheckCircle2 size={15} color="#10b981" /> Camera Active & Verified
                      </div>
                    )}
                  </div>
                </div>

                {/* Tile 2: Microphone Status */}
                <div className={`hardware-tile ${micStatus === "active" ? "active" : micStatus === "denied" ? "error" : "warning"}`}>
                  <div className="hardware-tile-head">
                    <div className="hardware-tile-title">
                      <Mic size={18} color={micStatus === "active" ? "#10b981" : "#2563eb"} />
                      <span>Microphone & Audio Monitoring</span>
                    </div>
                    <span className={`hardware-status-badge ${micStatus === "active" ? "verified" : micStatus === "denied" ? "denied" : "pending"}`}>
                      {micStatus === "active" ? "Verified" : micStatus === "denied" ? "Denied" : "Pending"}
                    </span>
                  </div>

                  {micError && (
                    <div className="hardware-error-pill" style={{ marginBottom: 8 }}>
                      <AlertTriangle size={15} />
                      <span>{micError}</span>
                    </div>
                  )}

                  {/* Live Web Audio Meter */}
                  <div className="mic-meter-live-container">
                    <div className="mic-decibel-scale">
                      <span>Live Audio Input Meter</span>
                      <span>{micStatus === "active" ? `${Math.round(micLevel)}%` : "0%"}</span>
                    </div>
                    <div className="mic-level-track">
                      <div className="mic-level-bar" style={{ width: `${Math.min(100, micLevel * 2)}%` }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    {micStatus !== "active" ? (
                      <button
                        type="button"
                        className="btn btn-outline small"
                        style={{ width: "100%" }}
                        onClick={handleEnableMicrophone}
                        disabled={isEnablingMic}
                      >
                        <Mic size={14} /> {isEnablingMic ? "Testing Microphone..." : "Enable Microphone & Test Audio"}
                      </button>
                    ) : (
                      <div className="hardware-ok-pill">
                        <CheckCircle2 size={15} color="#10b981" /> Microphone Connected & Audio Verified
                      </div>
                    )}
                  </div>
                </div>

                {/* Tile 3: Proctoring Environment & Simulation Fallback */}
                <div className={`hardware-tile ${cameraStatus === "active" && micStatus === "active" ? "active" : "warning"}`}>
                  <div className="hardware-tile-head">
                    <div className="hardware-tile-title">
                      <ShieldCheck size={18} color="#2563eb" />
                      <span>Proctoring Readiness</span>
                    </div>
                    <span className={`hardware-status-badge ${cameraStatus === "active" && micStatus === "active" ? "verified" : "pending"}`}>
                      {cameraStatus === "active" && micStatus === "active" ? "Ready" : "Waiting for Setup"}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 10 }}>
                    Fullscreen enforcement, tab-switch logging, and 3-warning anti-cheat active.
                  </div>

                  <button
                    type="button"
                    className="btn btn-soft small"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={handleEnableSimulation}
                    title="Enable synthetic stream for demo testing without physical hardware"
                  >
                    <Wifi size={14} /> Use Simulated Demo Media (Testing Mode)
                  </button>
                </div>
              </div>

              {/* Start Exam Launch Action */}
              <div className="launch-box" style={{ marginTop: 16 }}>
                <button
                  className="btn btn-primary launch-exam-btn"
                  disabled={!rulesAcknowledged || starting || (isProctoringActive && (cameraStatus !== "active" || micStatus !== "active"))}
                  onClick={() => handleStartExam(false)}
                >
                  {starting ? "Launching Workspace..." : "Start Examination Now"} <ArrowRight size={18} />
                </button>
                {!rulesAcknowledged ? (
                  <small className="launch-tip">Please check the rules acknowledgment checkbox to begin.</small>
                ) : isProctoringActive && (cameraStatus !== "active" || micStatus !== "active") ? (
                  <small className="launch-tip" style={{ color: "#d97706" }}>
                    Enable camera and microphone (or use Simulated Demo Media) to start.
                  </small>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: EXAMINATION RESULTS & REVIEW SCREEN
  // -------------------------------------------------------------
  if (result) {
    const evalData = result.result || {};
    const score = evalData.score ?? 0;
    const maxMarks = evalData.maximumMarks ?? (questions.length * 4);
    const accuracy = evalData.accuracy ?? 0;
    const correctCount = evalData.correct ?? 0;
    const incorrectCount = evalData.incorrect ?? 0;
    const unattemptedCount = evalData.unattempted ?? (questions.length - correctCount - incorrectCount);
    const details = evalData.details || [];

    const filteredDetails = details.filter((item) => {
      if (reviewFilter === "correct") return item.isCorrect;
      if (reviewFilter === "incorrect") return item.attempted && !item.isCorrect;
      if (reviewFilter === "unattempted") return !item.attempted;
      return true;
    });

    return (
      <div className="exam-results-screen">
        <div className="results-container">
          <div className="results-header">
            <div>
              <div className="results-badge">
                <Award size={16} /> Official Score Card & Analysis
              </div>
              <h1>{exam?.title || "Examination Results"}</h1>
              <p>Candidate: {user?.name} · Completed: {new Date().toLocaleDateString("en-IN")}</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" to={`/student/leaderboard?examId=${exam?.id || id}`}>
                <Trophy size={16} /> View Merit Leaderboard
              </Link>
              <Link className="btn btn-outline" to="/student/results">
                <BarChart3 size={16} /> Detailed Answer Key & Review
              </Link>
              <Link className="btn btn-soft" to="/student/exams">
                My Registered Exams <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Terminated Violation Alert Banner */}
          {result?.status === "TERMINATED" && (
            <div className="alert danger" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 10 }}>
              <AlertTriangle size={24} color="#dc2626" />
              <div>
                <strong style={{ fontSize: 15, display: "block", marginBottom: 2 }}>Assessment Terminated by AI Proctoring System</strong>
                <span style={{ fontSize: 13 }}>
                  This examination was automatically submitted because maximum violation strikes were reached ({result.terminationReason || "3 Proctoring Warnings Exceeded"}). All saved answers were evaluated.
                </span>
              </div>
            </div>
          )}

          {/* Merit Reward Awarded Banner */}
          {result?.reward && (
            <div style={{
              marginBottom: 24,
              padding: "16px 20px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.2))",
              border: "1.5px solid #10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  background: "#10b981",
                  color: "#ffffff",
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <Trophy size={24} />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#065f46" }}>
                    🎉 Merit Prize Reward Credited: ₹{result.reward.amount}
                  </div>
                  <div style={{ fontSize: 13, color: "#047857", marginTop: 2 }}>
                    {result.reward.message}. Deposited into your student wallet. You can withdraw directly to UPI!
                  </div>
                </div>
              </div>
              <Link to="/student/withdraw" className="btn btn-primary small" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <Wallet size={15} /> Withdraw Money <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {/* Metric Cards */}
          <div className="results-stats-grid">
            <div className="result-metric-card primary">
              <span className="metric-label">TOTAL SCORE</span>
              <div className="metric-huge">
                {score} <span className="metric-denom">/ {maxMarks}</span>
              </div>
              <span className="metric-sub">{Math.round((score / (maxMarks || 1)) * 100)}% Overall Score</span>
            </div>

            <div className="result-metric-card">
              <span className="metric-label">ACCURACY RATE</span>
              <div className="metric-huge">{accuracy}%</div>
              <span className="metric-sub">Precision of answered items</span>
            </div>

            <div className="result-metric-card green">
              <span className="metric-label">CORRECT ANSWERS</span>
              <div className="metric-huge">{correctCount}</div>
              <span className="metric-sub">+{correctCount * 4} Marks gained</span>
            </div>

            <div className="result-metric-card red">
              <span className="metric-label">INCORRECT ANSWERS</span>
              <div className="metric-huge">{incorrectCount}</div>
              <span className="metric-sub">-{incorrectCount} Negative penalty</span>
            </div>

            <div className="result-metric-card gray">
              <span className="metric-label">UNATTEMPTED</span>
              <div className="metric-huge">{unattemptedCount}</div>
              <span className="metric-sub">0 Marks deducted</span>
            </div>
          </div>

          {/* Question-by-Question Detailed Review */}
          <div className="results-review-card">
            <div className="review-filter-bar">
              <h3>Detailed Question Analysis</h3>
              <div className="review-filters">
                <button
                  className={`filter-btn ${reviewFilter === "all" ? "active" : ""}`}
                  onClick={() => setReviewFilter("all")}
                >
                  All ({details.length})
                </button>
                <button
                  className={`filter-btn ${reviewFilter === "correct" ? "active" : ""}`}
                  onClick={() => setReviewFilter("correct")}
                >
                  Correct ({correctCount})
                </button>
                <button
                  className={`filter-btn ${reviewFilter === "incorrect" ? "active" : ""}`}
                  onClick={() => setReviewFilter("incorrect")}
                >
                  Incorrect ({incorrectCount})
                </button>
                <button
                  className={`filter-btn ${reviewFilter === "unattempted" ? "active" : ""}`}
                  onClick={() => setReviewFilter("unattempted")}
                >
                  Unattempted ({unattemptedCount})
                </button>
              </div>
            </div>

            <div className="review-list">
              {filteredDetails.map((item, i) => {
                const questionObj = questions.find((q) => q.id === item.id) || {};
                return (
                  <div key={item.id} className={`review-item-card ${item.isCorrect ? "correct" : item.attempted ? "incorrect" : "unattempted"}`}>
                    <div className="review-item-head">
                      <div className="review-item-tags">
                        <span className="q-badge">Question {i + 1}</span>
                        <span className="subj-tag">{questionObj.subject} · {questionObj.chapter}</span>
                      </div>
                      <span className={`status-pill ${item.isCorrect ? "pill-correct" : item.attempted ? "pill-incorrect" : "pill-unattempted"}`}>
                        {item.isCorrect ? "✓ Correct (+4)" : item.attempted ? "✗ Incorrect (-1)" : "– Unattempted (0)"}
                      </span>
                    </div>

                    <div className="review-q-text">
                      <QuestionRenderer
                        question={questionObj}
                        selected={item.selectedOptions}
                        disabled={true}
                        showAnswer={true}
                      />
                    </div>

                    <div className="review-explanation-box">
                      <strong>Explanation & Verification:</strong>
                      <p>{item.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: LIVE FULL-SCREEN EXAMINATION UI (NO UNNECESSARY SCROLLING)
  // -------------------------------------------------------------
  const q = questions[idx] || {};

  return (
    <div className="live-exam-viewport">
      {/* 1. COMPACT PINNED HEADER */}
      <header className="live-exam-header">
        <div className="header-left">
          <Brand compact />
          <div className="exam-identity">
            <span className="exam-name">{exam?.title || "Examination Workspace"}</span>
            <span className="exam-meta-pill">
              Live Assessment · {questions.length} Questions · Total Marks: {exam?.marks || 300}
            </span>
          </div>
        </div>

        {/* Section Tabs in Header */}
        {sections.length > 1 && (
          <nav className="header-sections" aria-label="Exam Sections">
            {sections.map((sec) => (
              <button
                key={sec.name}
                type="button"
                className={`section-pill ${currentSection === sec.name ? "active" : ""}`}
                onClick={() => {
                  const firstIdx = questions.findIndex((item) => item.subject === sec.name);
                  if (firstIdx >= 0) handleJumpToQuestion(firstIdx);
                }}
              >
                <span>{sec.name}</span>
                <span className="sec-q-count">{sec.count}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="header-right">
          {/* Real-time Save Indicator */}
          <span className="save-status-indicator" title="Persistent Local Storage">
            <Wifi size={14} color="#10b981" />
            <span>{saving}</span>
          </span>

          {/* Prominent Countdown Timer */}
          <div className={`countdown-clock ${seconds < 300 ? "urgent" : ""}`}>
            <Clock3 size={17} />
            <div>
              <small>TIME REMAINING</small>
              <strong>{formatTimer(seconds)}</strong>
            </div>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            className="btn-header-action"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>

          {/* Final Submit Trigger */}
          <button
            type="button"
            className="btn btn-primary btn-submit-exam"
            onClick={() => setConfirm(true)}
          >
            Submit Exam <Send size={14} />
          </button>
        </div>
      </header>

      {/* 2. MAIN EXAMINATION VIEWPORT (STRICT 100VH NO-SCROLL LAYOUT) */}
      <div className="live-exam-body">
        {/* LEFT STATION: THE QUESTION CONTAINER */}
        <section className="station-question" aria-label="Question Workspace">
          {/* Pinned Question Header */}
          <div className="question-bar-header">
            <div className="q-bar-left">
              <span className="q-number-pill">
                Question {String(idx + 1).padStart(2, "0")} <small>of {questions.length}</small>
              </span>
              <span className="q-subject-pill">
                {q.subject} {q.chapter ? `· ${q.chapter}` : ""}
              </span>
              <span className="q-marking-pill">
                +4.0 Correct <span className="marking-sep">·</span> -1.0 Negative
              </span>
            </div>

            <div className="q-bar-right">
              <span className="q-type-badge">
                {q.questionType === "multiple_correct"
                  ? "Multiple Choice"
                  : q.questionType === "numerical"
                  ? "Numerical Response"
                  : "Single Choice MCQ"}
              </span>
              <span className={`q-status-badge ${getQuestionState(q, idx)}`}>
                {getQuestionState(q, idx) === "answered"
                  ? "Answered"
                  : getQuestionState(q, idx) === "marked"
                  ? "Marked for Review"
                  : getQuestionState(q, idx) === "answered-marked"
                  ? "Answered & Marked"
                  : "Not Answered"}
              </span>
            </div>
          </div>

          {/* Internal Question & Answer Scroll Container (Only scrolls if content is huge) */}
          <div className="question-scroll-viewport">
            <QuestionRenderer
              question={q}
              selected={answers[q.id]}
              onSelect={handleSelectAnswer}
              disabled={false}
            />
          </div>

          {/* PINNED ACTION FOOTER: ALWAYS VISIBLE WITHOUT SCROLLING */}
          <footer className="question-bar-footer">
            <div className="footer-left-actions">
              <button
                type="button"
                className={`btn btn-review-toggle ${marked.includes(q.id) ? "is-marked" : ""}`}
                onClick={handleToggleMark}
              >
                <Bookmark size={15} />
                <span>{marked.includes(q.id) ? "Marked for Review" : "Mark for Review"}</span>
              </button>

              <button
                type="button"
                className="btn btn-outline btn-clear-response"
                onClick={handleClearResponse}
                disabled={!isQuestionAnswered(q.id)}
              >
                Clear Response
              </button>
            </div>

            <div className="footer-right-actions">
              <button
                type="button"
                className="btn btn-outline btn-prev-q"
                disabled={idx <= 0}
                onClick={() => handleJumpToQuestion(idx - 1)}
              >
                <ArrowLeft size={16} /> Previous
              </button>

              <button
                type="button"
                className="btn btn-primary btn-save-next"
                onClick={handleSaveAndNext}
              >
                <span>{idx === questions.length - 1 ? "Review & Submit" : "Save & Next"}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </footer>
        </section>

        {/* RIGHT SIDEBAR: PROCTORING HUD & QUESTION PALETTE */}
        <aside className="station-sidebar" aria-label="Question Palette & Proctoring">
          {/* Proctoring Thumbnail HUD */}
          <div className="proctoring-hud-card">
            <div className="hud-video-frame">
              <video
                ref={(el) => {
                  liveVideoRef.current = el;
                  if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                    el.srcObject = cameraStreamRef.current;
                    el.muted = true;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="hud-video-elem"
              />
              <div className="hud-tag-live">
                <span className="live-dot" /> AI ACTIVE
              </div>
              <div className="hud-watermark">
                <span>{user?.name}</span>
                <span>REC ● MONITORED</span>
              </div>
            </div>

            <div className="hud-status-strip">
              <span className={`hud-indicator ${cameraStatus === "active" ? "ok" : "err"}`}>
                <Check size={12} /> Camera Active
              </span>
              <span className={`hud-indicator ${micStatus === "active" ? "ok" : "err"}`}>
                <Check size={12} /> Mic Monitoring
              </span>
              <span className={`hud-violation-count ${warningCount > 0 ? "warn" : ""}`} style={{ color: warningCount >= 2 ? "#ef4444" : warningCount === 1 ? "#f59e0b" : "#64748b", fontWeight: 700 }}>
                Violations: {warningCount}/3
              </span>
            </div>
          </div>

          {/* Question Palette Header & Summary */}
          <div className="palette-section-head">
            <div className="palette-title-wrap">
              <h3>Question Palette</h3>
              <span className="palette-count-badge">
                {answeredCount}/{questions.length} Answered
              </span>
            </div>

            {/* 6 Required Visual States Legend */}
            <div className="palette-states-legend">
              <div className="legend-row">
                <span className="legend-item">
                  <i className="legend-swatch answered" /> Answered
                </span>
                <span className="legend-item">
                  <i className="legend-swatch not-answered" /> Not Answered
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-item">
                  <i className="legend-swatch marked" /> Marked
                </span>
                <span className="legend-item">
                  <i className="legend-swatch answered-marked" /> Answered & Marked
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-item">
                  <i className="legend-swatch not-visited" /> Not Visited
                </span>
                <span className="legend-item">
                  <i className="legend-swatch current-ring" /> Current
                </span>
              </div>
            </div>
          </div>

          {/* Palette Grid Buttons */}
          <div className="palette-grid-viewport">
            {questions.map((item, i) => {
              const state = getQuestionState(item, i);
              const isCurrent = idx === i;

              return (
                <button
                  type="button"
                  key={item.id}
                  title={`Question ${i + 1}: ${item.subject} (${state})`}
                  onClick={() => handleJumpToQuestion(i)}
                  className={`palette-num-btn ${state} ${isCurrent ? "current" : ""}`}
                >
                  {i + 1}
                  {state === "answered-marked" && <span className="dot-answered" />}
                </button>
              );
            })}
          </div>

          {/* Quick Summary Card at Bottom of Sidebar */}
          <div className="sidebar-quick-summary">
            <div className="summary-pill answered">
              <strong>{answeredCount}</strong> Answered
            </div>
            <div className="summary-pill marked">
              <strong>{markedCount}</strong> Marked
            </div>
            <div className="summary-pill unanswered">
              <strong>{unansweredCount}</strong> Unanswered
            </div>
          </div>
        </aside>
      </div>

      {/* 3. CONFIRMATION MODAL BEFORE SUBMISSION */}
      {confirm && (
        <div className="exam-modal-overlay" onClick={() => setConfirm(false)}>
          <div className="exam-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon-wrap">
              <Send size={28} color="#2563eb" />
            </div>
            <h2>Confirm Examination Submission</h2>
            <p className="confirm-desc">
              Are you sure you want to finalize and submit your responses? You will receive immediate score evaluation.
            </p>

            <div className="confirm-breakdown-grid">
              <div className="confirm-stat">
                <span className="stat-label">Total Questions</span>
                <strong className="stat-num">{questions.length}</strong>
              </div>
              <div className="confirm-stat green">
                <span className="stat-label">Answered</span>
                <strong className="stat-num">{answeredCount}</strong>
              </div>
              <div className="confirm-stat purple">
                <span className="stat-label">Marked for Review</span>
                <strong className="stat-num">{markedCount}</strong>
              </div>
              <div className="confirm-stat amber">
                <span className="stat-label">Unanswered</span>
                <strong className="stat-num">{unansweredCount}</strong>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="confirm-warning-note">
                <AlertTriangle size={16} />
                <span>You have <strong>{unansweredCount} unanswered questions</strong>. These will receive 0 marks.</span>
              </div>
            )}

            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setConfirm(false)}
              >
                Return to Assessment
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitExam}
              >
                Yes, Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ACTIVE PROCTORING VIOLATION WARNING MODAL */}
      {activeWarning && (
        <div className="violation-modal-overlay">
          <div className={`violation-card warning-${activeWarning.count}`}>
            <div className="violation-icon-wrap">
              <AlertTriangle size={32} />
            </div>
            <h3 className="violation-title">{activeWarning.title}</h3>
            <p className="violation-desc">{activeWarning.message}</p>

            <div className="violation-strike-pills">
              <span className={`strike-pill ${activeWarning.count >= 1 ? "active" : ""}`}>1</span>
              <span className={`strike-pill ${activeWarning.count >= 2 ? "active" : ""}`}>2</span>
              <span className={`strike-pill ${activeWarning.count >= 3 ? "active" : ""}`}>3</span>
            </div>

            {activeWarning.count < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", padding: "10px 16px" }}
                onClick={() => setActiveWarning(null)}
              >
                I Understand & Return to Exam
              </button>
            ) : (
              <div style={{ color: "#dc2626", fontWeight: 800, fontSize: 16 }}>
                Auto-submitting in {activeWarning.countdown ?? 3}s...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
