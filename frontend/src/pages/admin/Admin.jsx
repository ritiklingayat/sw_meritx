import React, { useEffect, useState, useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Users,
  ClipboardList,
  Wallet,
  BookOpen,
  TrendingUp,
  CalendarDays,
  ShieldCheck,
  ArrowUpRight,
  Check,
  LifeBuoy,
  RefreshCw,
  ImagePlus,
  ListChecks,
  UploadCloud,
  X,
  Trash2,
  Trophy,
  Video,
  BarChart3,
  RotateCcw,
  Plus,
  Search,
  Filter,
  Eye,
  Target,
  GraduationCap,
  Phone,
  MapPin,
  Clock3,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Shell, Stat, Empty, Loading } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, money, friendlyDate } from "../../lib/api";
import { PaperTable, BankTable } from "../teacher/Teacher";
import QuestionRenderer from "../../components/QuestionRenderer";
import { questionService } from "../../services/questionService";
import {
  formatDateTime,
  formatDate,
  formatTime,
  formatExamWindow,
  formatCountdown,
  toDateTimeLocal,
  fromDateTimeLocal,
  getExamScheduleInfo,
  validateExamSchedule,
  extractExamSchedule,
  calculateEndTime,
  formatDurationHuman,
  DURATION_PRESETS,
  extractExamEditFields,
} from "../../services/schedulingService";
import AdminLeaderboard from "./AdminLeaderboard";
import AdminResults from "./AdminResults";
import "./Admin.css";

export { AdminLeaderboard, AdminResults };
export function useOverview() {
  const { token } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const refresh = () =>
    api("/admin/overview", { token })
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, [token]);
  return { data, error, refresh, token };
}
export function AdminDashboard() {
  const { data, error } = useOverview();
  return (
    <Shell
      title="Operations overview"
      kicker="ADMIN CONTROL CENTER"
      description="A clear view of exams, users, participation and performance."
      action={
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/admin/proctoring" className="btn btn-outline small">
            <Video size={15} /> Live Proctoring
          </Link>
          <Link to="/admin/leaderboards" className="btn btn-outline small">
            <Trophy size={15} /> Leaderboards
          </Link>
          <Link to="/admin/results" className="btn btn-outline small">
            <BarChart3 size={15} /> Exam Results
          </Link>
          <Link to="/admin/exams" className="btn btn-primary small">
            Manage Exams <ArrowUpRight size={15} />
          </Link>
        </div>
      }
    >
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="grid-4">
            <Stat
              icon={Users}
              label="Total Students"
              value={data.students}
              delta="Registered accounts"
            />
            <Stat
              icon={ClipboardList}
              label="Exam Registrations"
              value={data.registrations}
              tone="cyan"
              delta="Demo enrollments"
            />
            <Stat
              icon={BookOpen}
              label="Papers Submitted"
              value={data.papers.length}
              tone="purple"
              delta="Academic workflow"
            />
            <Stat
              icon={TrendingUp}
              label="Completed Attempts"
              value={data.attempts}
              tone="green"
              delta="Evaluated exams"
            />
          </div>
          <div className="grid-2" style={{ marginTop: 22 }}>
            <div className="panel">
              <div className="panel-head">
                <h3>Examination schedule</h3>
                <Link className="action-link" to="/admin/exams">
                  See all →
                </Link>
              </div>
              {data.exams.map((e) => (
                <div className="admin-row" key={e.id}>
                  <div className="admin-row-icon">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <strong>{e.title}</strong>
                    <small>
                      {friendlyDate(e.date)} · {e.type}
                    </small>
                  </div>
                  <span className="tag">{e.status}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Latest system activity</h3>
              {data.audit.length ? (
                data.audit.slice(0, 6).map((a) => (
                  <div className="admin-row" key={a.id}>
                    <div className="admin-row-icon">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <strong>{a.action.replaceAll("_", " ")}</strong>
                      <small>
                        {a.detail} · {new Date(a.date).toLocaleString("en-IN")}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="No recent activity" />
              )}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

const MAX_ARTWORK_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_ARTWORK_DATA_LENGTH = 1_800_000;

async function optimizeArtwork(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > MAX_ARTWORK_SOURCE_BYTES) throw new Error('The original image must be smaller than 20 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This image could not be read.'));
      element.src = objectUrl;
    });
    const scale = Math.min(1, 1600 / image.naturalWidth, 900 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      const result = canvas.toDataURL('image/webp', quality);
      if (result.length <= MAX_ARTWORK_DATA_LENGTH) return result;
    }
    throw new Error('The optimized image is still too large. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ManageExams() {
  const { data, refresh, token } = useOverview();
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState(null);
  const [registeredStudentsCount, setRegisteredStudentsCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const field = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const defaultNewExam = () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    const examDate = `${y}-${m}-${d}`;
    const startTime = "10:00";
    const durationPreset = 120; // 2 Hours
    const duration = 120;
    const customHours = 2;
    const customMinutes = 0;

    // Registration defaults: opens 7 days before, closes at exam start
    const regOpensDate = new Date(tomorrow.getTime() - 7 * 86400000);
    const regOpens = toDateTimeLocal(regOpensDate.toISOString());
    const regCloses = toDateTimeLocal(`${examDate}T${startTime}:00`);

    return {
      title: "",
      description: "",
      category: "Programming & Tech",
      type: "Technical Assessment",
      subject: "Java · Core Programming & Algorithms",
      tag: "Mock Exam",
      status: "published",
      questions: 30,
      marks: 100,
      passingMarks: 40,
      negativeMarking: true,
      negativeMarkValue: 1,
      maxAttempts: 1,
      fee: 0,
      registrationOpen: true,
      proctoringRequired: true,
      cameraRequired: true,
      micRequired: true,
      showResultsImmediate: true,
      enableLeaderboard: true,
      imageUrl: null,
      examDate,
      startTime,
      durationPreset,
      customHours,
      customMinutes,
      duration,
      registrationOpensAt: regOpens,
      registrationClosesAt: regCloses,
      instructions:
        "The examination contains multiple-choice questions.\nEach correct question earns marks as per configuration.\nNegative marking applies for incorrect attempts.\nContinuous proctoring is enabled: keep webcam and microphone active.",
    };
  };

  function startCreate() {
    setEditing(null);
    setIsCreating(true);
    setCurrentStep(1);
    setRegisteredStudentsCount(0);
    setForm(defaultNewExam());
    setMsg("");
  }

  async function edit(exam) {
    setIsCreating(false);
    setEditing(exam.id);
    setCurrentStep(1);
    setMsg("");

    // Check how many students are registered for this exam
    try {
      const regsRes = await api(`/admin/registrations?examId=${exam.id}`, { token }).catch(() => ({ registrations: [] }));
      const count = regsRes.registrations?.length ?? (exam.registered || 0);
      setRegisteredStudentsCount(count);
    } catch {
      setRegisteredStudentsCount(exam.registered || 0);
    }

    const editFields = extractExamEditFields(exam);

    setForm({
      title: exam.title || "",
      description: exam.description || "",
      category:
        exam.category ||
        (exam.type?.includes("NEET")
          ? "Medical Entrance"
          : exam.type?.includes("JEE")
          ? "Engineering Entrance"
          : "Programming & Tech"),
      type: exam.type || "Standard Exam",
      subject: exam.subject || "",
      tag: exam.tag || "",
      status: exam.status || "published",
      questions: exam.questions || 30,
      marks: exam.marks || 100,
      passingMarks: exam.passingMarks || 40,
      negativeMarking: exam.negativeMarking !== false,
      negativeMarkValue: exam.negativeMarkValue || 1,
      maxAttempts: exam.maxAttempts || 1,
      fee: exam.fee ?? 0,
      registrationOpen: exam.registrationOpen !== false,
      proctoringRequired: exam.proctoringRequired !== false,
      cameraRequired: exam.cameraRequired !== false && exam.proctoringRequired !== false,
      micRequired: exam.micRequired !== false && exam.proctoringRequired !== false,
      showResultsImmediate: exam.showResultsImmediate !== false,
      enableLeaderboard: exam.enableLeaderboard !== false,
      imageUrl: exam.imageUrl || null,
      examDate: editFields.examDate,
      startTime: editFields.startTime,
      durationPreset: editFields.durationPreset,
      customHours: editFields.customHours,
      customMinutes: editFields.customMinutes,
      duration: editFields.duration,
      registrationOpensAt: editFields.regOpens,
      registrationClosesAt: editFields.regCloses,
      instructions: Array.isArray(exam.configuration?.instructions)
        ? exam.configuration.instructions.join("\n")
        : exam.instructions ||
          "Attempt all questions within the allocated duration.\nContinuous proctoring is enabled for this assessment.",
    });
  }

  async function chooseImage(file) {
    setImageBusy(true);
    try {
      field("imageUrl", await optimizeArtwork(file));
      setMsg("Artwork ready. Save the examination to publish it.");
    } catch (error) {
      setMsg(error.message);
    } finally {
      setImageBusy(false);
    }
  }

  // Handle Preset Click
  const handlePresetClick = (presetValue) => {
    if (presetValue === "custom") {
      const customTotal = (Number(form.customHours) || 0) * 60 + (Number(form.customMinutes) || 0);
      setForm((curr) => ({
        ...curr,
        durationPreset: "custom",
        duration: customTotal > 0 ? customTotal : 60,
      }));
    } else {
      setForm((curr) => ({
        ...curr,
        durationPreset: presetValue,
        duration: presetValue,
      }));
    }
  };

  // Handle Custom Duration Change
  const handleCustomDurationChange = (hours, mins) => {
    const h = Math.max(0, parseInt(hours, 10) || 0);
    const m = Math.max(0, Math.min(59, parseInt(mins, 10) || 0));
    const total = h * 60 + m;
    setForm((curr) => ({
      ...curr,
      customHours: h,
      customMinutes: m,
      duration: total > 0 ? total : 15,
    }));
  };

  // Auto calculate Ending Time whenever Date, Start Time, or Duration changes
  const calculatedEnd = useMemo(() => {
    if (!form || !form.examDate || !form.startTime || !form.duration) return null;
    return calculateEndTime({
      examDate: form.examDate,
      startTime: form.startTime,
      durationMinutes: form.duration,
    });
  }, [form?.examDate, form?.startTime, form?.duration]);

  // Shortcut to set registration closing time exactly to exam start time
  const setRegClosesToExamStart = () => {
    if (!form || !form.examDate || !form.startTime) return;
    const targetDt = toDateTimeLocal(`${form.examDate}T${form.startTime}:00`);
    field("registrationClosesAt", targetDt);
  };

  // Validate specific step before navigating forward
  function validateStep(step) {
    if (!form) return false;
    if (step === 1) {
      if (!form.title || !form.title.trim()) {
        setMsg("Please enter an Examination Title.");
        return false;
      }
      if (!form.subject || !form.subject.trim()) {
        setMsg("Please enter a Subject / Domain.");
        return false;
      }
      if (!form.questions || Number(form.questions) <= 0) {
        setMsg("Total Questions must be greater than 0.");
        return false;
      }
      if (!form.marks || Number(form.marks) <= 0) {
        setMsg("Total Marks must be greater than 0.");
        return false;
      }
      if (Number(form.passingMarks) < 0 || Number(form.passingMarks) > Number(form.marks)) {
        setMsg("Passing marks must be between 0 and Total Marks.");
        return false;
      }
    }

    if (step === 2) {
      if (!form.examDate) {
        setMsg("Please select an Examination Date.");
        return false;
      }
      if (!form.startTime) {
        setMsg("Please select an Examination Start Time.");
        return false;
      }
      if (!form.duration || Number(form.duration) <= 0) {
        setMsg("Examination Duration must be at least 15 minutes.");
        return false;
      }
    }

    if (step === 3) {
      if (!form.registrationOpensAt) {
        setMsg("Please specify when registration opens.");
        return false;
      }
      if (!form.registrationClosesAt) {
        setMsg("Please specify when registration closes.");
        return false;
      }
      const regStartMs = new Date(form.registrationOpensAt).getTime();
      const regEndMs = new Date(form.registrationClosesAt).getTime();
      if (regEndMs <= regStartMs) {
        setMsg("Registration closing time must be strictly after registration opening time.");
        return false;
      }
      const calc = calculateEndTime({
        examDate: form.examDate,
        startTime: form.startTime,
        durationMinutes: form.duration,
      });
      if (calc.startsAtIso) {
        const examStartMs = new Date(calc.startsAtIso).getTime();
        if (regEndMs > examStartMs) {
          setMsg("Registration must close on or before the examination starts.");
          return false;
        }
      }
      if (Number(form.fee) < 0) {
        setMsg("Registration fee cannot be negative.");
        return false;
      }
    }

    setMsg("");
    return true;
  }

  async function save(event) {
    if (event) event.preventDefault();
    setBusy(true);
    setMsg("");

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setBusy(false);
      return;
    }

    try {
      const calc = calculateEndTime({
        examDate: form.examDate,
        startTime: form.startTime,
        durationMinutes: Number(form.duration),
      });

      const startsAtIso = calc.startsAtIso;
      const endsAtIso = calc.endsAtIso;
      const regOpensIso = fromDateTimeLocal(form.registrationOpensAt);
      const regClosesIso = fromDateTimeLocal(form.registrationClosesAt);

      const instructionsList = form.instructions
        ? form.instructions.split("\n").map((s) => s.trim()).filter(Boolean)
        : [];

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        type: form.type || form.category,
        subject: form.subject.trim(),
        date: form.examDate,
        time: calc.formattedStartTime,
        duration: Number(form.duration),
        fee: Number(form.fee || 0),
        marks: Number(form.marks),
        passingMarks: Number(form.passingMarks),
        negativeMarking: Boolean(form.negativeMarking),
        negativeMarkValue: Number(form.negativeMarkValue || 1),
        questions: Number(form.questions),
        maxAttempts: Number(form.maxAttempts || 1),
        proctoringRequired: Boolean(form.proctoringRequired),
        cameraRequired: Boolean(form.cameraRequired),
        micRequired: Boolean(form.micRequired),
        showResultsImmediate: Boolean(form.showResultsImmediate),
        enableLeaderboard: Boolean(form.enableLeaderboard),
        tag: form.tag?.trim() || "",
        status: form.status || "published",
        registrationOpen: Boolean(form.registrationOpen),
        imageUrl: form.imageUrl,
        schedule: {
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          registrationOpensAt: regOpensIso,
          registrationClosesAt: regClosesIso,
          timezone: "Asia/Kolkata",
        },
        configuration: {
          rules: {
            single_correct: {
              correct: 4,
              incorrect: form.negativeMarking ? -Number(form.negativeMarkValue || 1) : 0,
              unanswered: 0,
            },
          },
          instructions: instructionsList.length
            ? instructionsList
            : [
                "Attempt all questions within the allocated duration.",
                "Once submitted, answers cannot be edited.",
                form.proctoringRequired
                  ? "Webcam and screen proctoring is enabled."
                  : "Standard examination environment.",
              ],
        },
      };

      if (isCreating) {
        await api("/admin/exams", { method: "POST", token, body: payload });
        setMsg("Examination created and published successfully.");
      } else {
        await api(`/admin/exams/${editing}`, { method: "PUT", token, body: payload });
        setMsg("Examination updated successfully.");
      }

      setEditing(null);
      setIsCreating(false);
      setForm(null);
      refresh();
    } catch (error) {
      setMsg(error.message || "Failed to save examination.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(examId, examTitle) {
    if (!window.confirm(`Are you sure you want to delete "${examTitle}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api(`/admin/exams/${examId}`, { method: "DELETE", token });
      setMsg(`Examination "${examTitle}" was deleted successfully.`);
      if (editing === examId) {
        setEditing(null);
        setForm(null);
      }
      refresh();
    } catch (err) {
      setMsg(err.message || "Failed to delete examination.");
    } finally {
      setBusy(false);
    }
  }

  const examsList = (data?.exams || []).filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q)
    );
  });

  return (
    <Shell
      title="Examination Management & Scheduling"
      kicker="ADMIN EXAM OPERATIONS"
      description="Configure clean examination details, simplified schedule & duration, auto-calculated end time, registration windows, and proctoring rules."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary small" onClick={startCreate}>
            <Plus size={15} /> Create New Examination
          </button>
          <Link className="btn btn-outline small" to="/admin/import">
            <UploadCloud size={15} /> Import MCQs
          </Link>
        </div>
      }
    >
      {msg && (
        <div
          className={`alert ${
            msg.includes("successfully") || msg.includes("deleted") ? "success" : "error"
          }`}
          style={{ marginBottom: 18 }}
        >
          {msg}
        </div>
      )}

      {!data ? (
        <Loading />
      ) : (
        <div className="admin-catalog-layout">
          {/* Left Column: Examination Inventory List */}
          <div className="panel admin-catalog-list">
            <div className="panel-head">
              <div>
                <h3>Examination Catalog ({examsList.length})</h3>
                <p className="muted">Live status, scheduled windows, and student access.</p>
              </div>
              <button className="btn btn-soft small" onClick={refresh} title="Refresh catalog">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Search examinations by title or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                }}
              />
            </div>

            <div className="admin-catalog-stack">
              {examsList.map((exam) => {
                const schedule = getExamScheduleInfo(exam);
                const isSelected = editing === exam.id;

                const statusColor =
                  schedule.examStatus === "Live"
                    ? "#10b981"
                    : schedule.examStatus === "Starting Soon"
                    ? "#f59e0b"
                    : schedule.examStatus === "Completed"
                    ? "#64748b"
                    : "#2563eb";

                return (
                  <div
                    className={`admin-exam-row ${isSelected ? "selected" : ""}`}
                    key={exam.id}
                    style={{
                      padding: "14px 12px",
                      borderRadius: 10,
                      background: isSelected ? "#eff6ff" : "#fff",
                      border: isSelected ? "1.5px solid #3b82f6" : "1px solid #f1f5f9",
                      marginBottom: 10,
                    }}
                  >
                    {exam.imageUrl ? (
                      <img
                        src={exam.imageUrl}
                        alt=""
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }}
                      />
                    ) : (
                      <div className="admin-image-placeholder" style={{ width: 56, height: 56, borderRadius: 8 }}>
                        <BookOpen size={22} />
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: `${statusColor}18`,
                            color: statusColor,
                            textTransform: "uppercase",
                          }}
                        >
                          ● {schedule.examStatus}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: schedule.isRegistrationOpen ? "#ecfdf5" : "#f1f5f9",
                            color: schedule.isRegistrationOpen ? "#059669" : "#64748b",
                          }}
                        >
                          {schedule.registrationStatus}
                        </span>

                        {schedule.proctoringRequired ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#4f46e5",
                              background: "#eef2ff",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            🛡️ Proctored
                          </span>
                        ) : null}
                      </div>

                      <strong style={{ fontSize: 14, color: "#0f172a", display: "block" }}>
                        {exam.title}
                      </strong>

                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                        <span>⏱️ Window: {formatExamWindow(schedule.startsAt, schedule.endsAt)}</span>
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: "#94a3b8",
                          marginTop: 2,
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          Duration: <strong>{exam.duration} mins</strong>
                        </span>
                        <span>
                          Marks: <strong>{exam.marks || 100}</strong>
                        </span>
                        <span>
                          Fee: <strong>{exam.fee ? money(exam.fee) : "FREE"}</strong>
                        </span>
                        <span>
                          Questions: <strong>{exam.questions || 30}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="admin-row-actions" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        className="btn btn-soft small"
                        onClick={() => edit(exam)}
                        style={{ fontWeight: 700, padding: "6px 12px" }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline small danger"
                        onClick={() => handleDelete(exam.id, exam.title)}
                        title="Delete examination"
                        style={{ padding: "6px 9px" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Simplified, Modern 4-Step Examination Form */}
          {form ? (
            <div className="panel admin-sticky-editor" style={{ background: "#fff" }}>
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <div>
                  <span
                    className="demo-pill"
                    style={{
                      background: isCreating ? "#ecfdf5" : "#eff6ff",
                      color: isCreating ? "#059669" : "#2563eb",
                    }}
                  >
                    {isCreating ? "NEW EXAMINATION" : "EDIT EXAMINATION"}
                  </span>
                  <h3 style={{ marginTop: 4 }}>
                    {isCreating ? "Create New Examination" : `Edit: ${form.title || "Examination"}`}
                  </h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close editor"
                  onClick={() => {
                    setEditing(null);
                    setIsCreating(false);
                    setForm(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Notice Banner: If editing an exam with registered students */}
              {editing && registeredStudentsCount > 0 && (
                <div className="registered-students-alert">
                  <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>
                      Notice: {registeredStudentsCount} student{registeredStudentsCount > 1 ? "s have" : " has"}{" "}
                      already registered for this examination.
                    </strong>
                    <div style={{ fontSize: 12, marginTop: 2, color: "#b45309" }}>
                      Modifying the examination date or timing will automatically update their scheduled exam time on their
                      dashboard without disturbing their registration or payment.
                    </div>
                  </div>
                </div>
              )}

              {/* 4-Step Stepper Bar */}
              <div className="exam-stepper-container">
                <div className="exam-stepper">
                  <button
                    type="button"
                    className={`exam-step-btn ${
                      currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""
                    }`}
                    onClick={() => setCurrentStep(1)}
                  >
                    <span className="exam-step-num">{currentStep > 1 ? "✓" : "1"}</span>
                    <span>1. Basic Details</span>
                  </button>

                  <button
                    type="button"
                    className={`exam-step-btn ${
                      currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""
                    }`}
                    onClick={() => {
                      if (validateStep(1)) setCurrentStep(2);
                    }}
                  >
                    <span className="exam-step-num">{currentStep > 2 ? "✓" : "2"}</span>
                    <span>2. Scheduling</span>
                  </button>

                  <button
                    type="button"
                    className={`exam-step-btn ${
                      currentStep === 3 ? "active" : currentStep > 3 ? "completed" : ""
                    }`}
                    onClick={() => {
                      if (validateStep(1) && validateStep(2)) setCurrentStep(3);
                    }}
                  >
                    <span className="exam-step-num">{currentStep > 3 ? "✓" : "3"}</span>
                    <span>3. Registration</span>
                  </button>

                  <button
                    type="button"
                    className={`exam-step-btn ${currentStep === 4 ? "active" : ""}`}
                    onClick={() => {
                      if (validateStep(1) && validateStep(2) && validateStep(3)) setCurrentStep(4);
                    }}
                  >
                    <span className="exam-step-num">4</span>
                    <span>4. Review & Save</span>
                  </button>
                </div>
              </div>

              {/* STEP 1: Basic Examination Details */}
              {currentStep === 1 && (
                <div className="exam-step-content" style={{ display: "grid", gap: 14 }}>
                  <label>
                    Examination Name / Title *
                    <input
                      required
                      placeholder="e.g. Java Programming Assessment, JEE Main Grand Mock"
                      value={form.title}
                      onChange={(e) => field("title", e.target.value)}
                    />
                  </label>

                  <label>
                    Examination Description
                    <textarea
                      rows="3"
                      placeholder="Provide syllabus scope, test overview, and preparation guidelines..."
                      value={form.description}
                      onChange={(e) => field("description", e.target.value)}
                    />
                  </label>

                  <div className="admin-form-grid">
                    <label>
                      Examination Category *
                      <select value={form.category} onChange={(e) => field("category", e.target.value)}>
                        <option value="Programming & Tech">Programming & Tech (Java / IT / Coding)</option>
                        <option value="Engineering Entrance">Engineering Entrance (JEE Main / Advanced)</option>
                        <option value="Medical Entrance">Medical Entrance (NEET UG)</option>
                        <option value="State Entrance">State Entrance (MHT-CET / State Exams)</option>
                        <option value="General Assessment">General Academic Assessment</option>
                      </select>
                    </label>

                    <label>
                      Subject / Domain *
                      <input
                        required
                        placeholder="e.g. Java · Data Structures · OOP"
                        value={form.subject}
                        onChange={(e) => field("subject", e.target.value)}
                      />
                    </label>

                    <label>
                      Total Questions *
                      <input
                        required
                        type="number"
                        min="1"
                        max="300"
                        value={form.questions}
                        onChange={(e) => field("questions", e.target.value)}
                      />
                    </label>

                    <label>
                      Total Marks *
                      <input
                        required
                        type="number"
                        min="1"
                        max="1000"
                        value={form.marks}
                        onChange={(e) => field("marks", e.target.value)}
                      />
                    </label>

                    <label>
                      Passing Marks *
                      <input
                        required
                        type="number"
                        min="0"
                        max={form.marks || 1000}
                        value={form.passingMarks}
                        onChange={(e) => field("passingMarks", e.target.value)}
                      />
                    </label>

                    <label>
                      Badge / Tag (Optional)
                      <input
                        placeholder="e.g. Trending, Most Popular, Free, Live"
                        value={form.tag}
                        onChange={(e) => field("tag", e.target.value)}
                      />
                    </label>
                  </div>

                  {/* Artwork upload */}
                  <ArtworkField
                    label="Examination Poster Artwork (Optional)"
                    value={form.imageUrl}
                    busy={imageBusy}
                    onChoose={chooseImage}
                    onRemove={() => field("imageUrl", null)}
                  />

                  {/* Step 1 Navigation */}
                  <div className="step-nav-footer">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setEditing(null);
                        setIsCreating(false);
                        setForm(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (validateStep(1)) setCurrentStep(2);
                      }}
                    >
                      Next: Simple Scheduling →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Simple Examination Scheduling */}
              {currentStep === 2 && (
                <div className="exam-step-content" style={{ display: "grid", gap: 16 }}>
                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <strong style={{ fontSize: 13, color: "#1e293b" }}>Quick & Simplified Scheduling</strong>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                      Pick the date, starting time, and duration. The ending time is calculated automatically.
                    </p>
                  </div>

                  {/* The 3 Primary Scheduling Fields */}
                  <div className="admin-form-grid">
                    <label>
                      1. Examination Date *
                      <input
                        required
                        type="date"
                        value={form.examDate}
                        onChange={(e) => field("examDate", e.target.value)}
                      />
                    </label>

                    <label>
                      2. Examination Start Time *
                      <input
                        required
                        type="time"
                        value={form.startTime}
                        onChange={(e) => field("startTime", e.target.value)}
                      />
                    </label>
                  </div>

                  {/* Duration Presets */}
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 12, color: "#475569" }}>
                      3. Examination Duration (Presets or Custom) *
                    </label>

                    <div className="duration-preset-grid">
                      {DURATION_PRESETS.map((preset) => {
                        const isSelected = form.durationPreset === preset.value;
                        return (
                          <button
                            type="button"
                            key={String(preset.value)}
                            className={`duration-chip ${isSelected ? "selected" : ""}`}
                            onClick={() => handlePresetClick(preset.value)}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Duration Inputs */}
                    {form.durationPreset === "custom" && (
                      <div className="custom-duration-grid">
                        <label>
                          Hours:
                          <input
                            type="number"
                            min="0"
                            max="24"
                            value={form.customHours}
                            onChange={(e) => handleCustomDurationChange(e.target.value, form.customMinutes)}
                          />
                        </label>
                        <label>
                          Minutes:
                          <input
                            type="number"
                            min="0"
                            max="59"
                            step="5"
                            value={form.customMinutes}
                            onChange={(e) => handleCustomDurationChange(form.customHours, e.target.value)}
                          />
                        </label>
                        <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
                          = {form.duration} minutes total
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Live Automatically Calculated End Time Box */}
                  {calculatedEnd && (
                    <div className="calculated-endtime-card">
                      <div className="calculated-endtime-title">
                        <Clock3 size={18} />
                        <span>Live Examination Schedule Preview</span>
                      </div>
                      <div className="calculated-endtime-grid">
                        <div className="calculated-endtime-item">
                          <span className="label">Date</span>
                          <strong className="val">{calculatedEnd.formattedDate}</strong>
                        </div>
                        <div className="calculated-endtime-item">
                          <span className="label">Start Time</span>
                          <strong className="val">{calculatedEnd.formattedStartTime}</strong>
                        </div>
                        <div className="calculated-endtime-item">
                          <span className="label">Duration</span>
                          <strong className="val">{calculatedEnd.formattedDuration}</strong>
                        </div>
                        <div className="calculated-endtime-item highlight">
                          <span className="label" style={{ color: "#0284c7" }}>
                            Automatically Calculated End Time
                          </span>
                          <strong className="val primary">{calculatedEnd.formattedEndTime}</strong>
                        </div>
                      </div>

                      {calculatedEnd.isNextDay && (
                        <div className="next-day-alert-banner">
                          <span>🌙</span>
                          <span>
                            Overnight Examination: This session spans across midnight and ends on the following calendar day.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2 Navigation */}
                  <div className="step-nav-footer">
                    <button type="button" className="btn btn-outline" onClick={() => setCurrentStep(1)}>
                      ← Back to Details
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (validateStep(2)) setCurrentStep(3);
                      }}
                    >
                      Next: Registration & Settings →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Registration Window & Examination Settings */}
              {currentStep === 3 && (
                <div className="exam-step-content" style={{ display: "grid", gap: 18 }}>
                  {/* Registration Details */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h4 style={{ margin: 0, fontSize: 13, color: "#334155", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Registration Window & Fee
                      </h4>
                      <button
                        type="button"
                        className="btn btn-soft small"
                        onClick={setRegClosesToExamStart}
                        style={{ fontSize: 11, padding: "4px 8px" }}
                        title="Set registration closing time to match exam start time"
                      >
                        ⚡ Sync Closing to Exam Start
                      </button>
                    </div>

                    <div className="admin-form-grid">
                      <label>
                        Registration Opens (IST) *
                        <input
                          required
                          type="datetime-local"
                          value={form.registrationOpensAt}
                          onChange={(e) => field("registrationOpensAt", e.target.value)}
                        />
                      </label>

                      <label>
                        Registration Closes (IST) *
                        <input
                          required
                          type="datetime-local"
                          value={form.registrationClosesAt}
                          onChange={(e) => field("registrationClosesAt", e.target.value)}
                        />
                      </label>

                      <label>
                        Registration Fee (INR ₹) *
                        <input
                          required
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0 for Free"
                          value={form.fee}
                          onChange={(e) => field("fee", e.target.value)}
                        />
                      </label>

                      <label>
                        Max Attempts per Student *
                        <input
                          required
                          type="number"
                          min="1"
                          max="10"
                          value={form.maxAttempts}
                          onChange={(e) => field("maxAttempts", e.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Modern Switches (Section D) */}
                  <div style={{ borderTop: "1px solid #edf1f8", paddingTop: 14 }}>
                    <h4 style={{ fontSize: 13, color: "#334155", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Examination Policy & Feature Switches
                    </h4>

                    <div className="setting-toggles-grid">
                      {/* Proctoring */}
                      <div className="setting-toggle-card">
                        <div className="setting-toggle-info">
                          <strong>Enable Proctoring</strong>
                          <span>Continuous candidate focus, window blur detection and AI integrity monitoring</span>
                        </div>
                        <label className="modern-switch">
                          <input
                            type="checkbox"
                            checked={form.proctoringRequired}
                            onChange={(e) => {
                              const val = e.target.checked;
                              field("proctoringRequired", val);
                              if (!val) {
                                field("cameraRequired", false);
                                field("micRequired", false);
                              } else {
                                field("cameraRequired", true);
                                field("micRequired", true);
                              }
                            }}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      {/* Camera Requirement */}
                      <div className="setting-toggle-card">
                        <div className="setting-toggle-info">
                          <strong>Require Webcam Camera</strong>
                          <span>Candidate must connect and share live webcam stream to enter exam</span>
                        </div>
                        <label className="modern-switch">
                          <input
                            type="checkbox"
                            checked={form.cameraRequired}
                            onChange={(e) => field("cameraRequired", e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      {/* Microphone Requirement */}
                      <div className="setting-toggle-card">
                        <div className="setting-toggle-info">
                          <strong>Require Microphone</strong>
                          <span>Continuous ambient audio stream monitoring during the exam session</span>
                        </div>
                        <label className="modern-switch">
                          <input
                            type="checkbox"
                            checked={form.micRequired}
                            onChange={(e) => field("micRequired", e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      {/* Negative Marking */}
                      <div className="setting-toggle-card">
                        <div className="setting-toggle-info">
                          <strong>Enable Negative Marking</strong>
                          <span>Deduct 1 mark for each incorrect MCQ answer response</span>
                        </div>
                        <label className="modern-switch">
                          <input
                            type="checkbox"
                            checked={form.negativeMarking}
                            onChange={(e) => field("negativeMarking", e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      {/* Instant Results */}
                      <div className="setting-toggle-card">
                        <div className="setting-toggle-info">
                          <strong>Instant Result Display</strong>
                          <span>Show candidate score and score breakdown immediately upon submission</span>
                        </div>
                        <label className="modern-switch">
                          <input
                            type="checkbox"
                            checked={form.showResultsImmediate}
                            onChange={(e) => field("showResultsImmediate", e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      {/* Leaderboard */}
                      <div className="setting-toggle-card">
                        <div className="setting-toggle-info">
                          <strong>Enable Public Leaderboard</strong>
                          <span>Include candidate rankings on public and institutional leaderboards</span>
                        </div>
                        <label className="modern-switch">
                          <input
                            type="checkbox"
                            checked={form.enableLeaderboard}
                            onChange={(e) => field("enableLeaderboard", e.target.checked)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 Navigation */}
                  <div className="step-nav-footer">
                    <button type="button" className="btn btn-outline" onClick={() => setCurrentStep(2)}>
                      ← Back to Schedule
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (validateStep(3)) setCurrentStep(4);
                      }}
                    >
                      Next: Review & Confirm →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Publish / Save Changes */}
              {currentStep === 4 && (
                <div className="exam-step-content" style={{ display: "grid", gap: 16 }}>
                  {/* Summary Card */}
                  <div className="exam-review-card">
                    <div>
                      <div className="exam-review-section-title">Examination Details</div>
                      <strong style={{ fontSize: 16, color: "#0f172a" }}>{form.title}</strong>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        Category: <strong>{form.category}</strong> · Subject: <strong>{form.subject}</strong>
                        {form.tag ? ` · Tag: ${form.tag}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        Questions: <strong>{form.questions}</strong> · Total Marks: <strong>{form.marks}</strong> · Passing Marks:{" "}
                        <strong>{form.passingMarks}</strong>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                      <div className="exam-review-section-title">Examination Schedule</div>
                      <div style={{ fontSize: 13, color: "#0f172a", display: "grid", gap: 4 }}>
                        <div>📅 Date: <strong>{calculatedEnd?.formattedDate || form.examDate}</strong></div>
                        <div>🕒 Start Time: <strong>{calculatedEnd?.formattedStartTime || form.startTime}</strong></div>
                        <div>⏱️ Duration: <strong>{calculatedEnd?.formattedDuration}</strong></div>
                        <div style={{ color: "#0284c7" }}>
                          🏁 Automatically Calculated End Time: <strong>{calculatedEnd?.formattedEndTime}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                      <div className="exam-review-section-title">Registration & Enrollment</div>
                      <div style={{ fontSize: 12, color: "#475569", display: "grid", gap: 4 }}>
                        <div>
                          Registration Window:{" "}
                          <strong>
                            {form.registrationOpensAt ? formatDateTime(form.registrationOpensAt) : "—"} to{" "}
                            {form.registrationClosesAt ? formatDateTime(form.registrationClosesAt) : "—"}
                          </strong>
                        </div>
                        <div>
                          Registration Fee:{" "}
                          <strong>{Number(form.fee) > 0 ? money(form.fee) : "FREE (₹0)"}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                      <div className="exam-review-section-title">Configured Policies</div>
                      <div className="exam-review-badge-list">
                        <span className={`exam-review-badge ${form.proctoringRequired ? "active" : "inactive"}`}>
                          {form.proctoringRequired ? "🛡️ Proctoring Enabled" : "Proctoring Disabled"}
                        </span>
                        <span className={`exam-review-badge ${form.cameraRequired ? "active" : "inactive"}`}>
                          {form.cameraRequired ? "📷 Camera Required" : "No Camera"}
                        </span>
                        <span className={`exam-review-badge ${form.micRequired ? "active" : "inactive"}`}>
                          {form.micRequired ? "🎙️ Mic Required" : "No Mic"}
                        </span>
                        <span className={`exam-review-badge ${form.negativeMarking ? "active" : "inactive"}`}>
                          {form.negativeMarking ? "⚠️ Negative Marking (-1)" : "No Negative Marking"}
                        </span>
                        <span className={`exam-review-badge ${form.showResultsImmediate ? "active" : "inactive"}`}>
                          {form.showResultsImmediate ? "📊 Instant Results" : "Delayed Results"}
                        </span>
                        <span className={`exam-review-badge ${form.enableLeaderboard ? "active" : "inactive"}`}>
                          {form.enableLeaderboard ? "🏆 Leaderboard Enabled" : "No Leaderboard"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Candidate Instructions Editor */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                      Candidate Instructions (One per line)
                    </label>
                    <textarea
                      rows="4"
                      value={form.instructions}
                      onChange={(e) => field("instructions", e.target.value)}
                      placeholder="Instructions candidates will see before starting the test..."
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </div>

                  {/* Step 4 Navigation */}
                  <div className="step-nav-footer">
                    <button type="button" className="btn btn-outline" onClick={() => setCurrentStep(3)}>
                      ← Back to Settings
                    </button>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          setEditing(null);
                          setIsCreating(false);
                          setForm(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy || imageBusy}
                        onClick={save}
                        style={{ padding: "10px 20px", fontWeight: 700 }}
                      >
                        {busy
                          ? "Saving..."
                          : isCreating
                          ? "Create & Publish Examination"
                          : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="panel admin-editor-empty">
              <CalendarDays size={40} color="#3b82f6" />
              <h3>Select or Create an Examination</h3>
              <p>
                Choose an examination from the catalog to edit its scheduling, duration, and proctoring policy, or
                create a new examination in 4 simple steps.
              </p>
              <button className="btn btn-primary small" onClick={startCreate} style={{ marginTop: 14 }}>
                <Plus size={15} /> Create Examination
              </button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

export function PrizeManagement() {
  const { token, user } = useAuth();
  const [exams,setExams]=useState([]),[items,setItems]=useState([]),[rankings,setRankings]=useState([]);
  const [examId,setExamId]=useState(''),[studentId,setStudentId]=useState(''),[rank,setRank]=useState(1),[message,setMessage]=useState('');
  const refresh=()=>Promise.all([api('/admin/exams',{token}),api('/admin/prize-distributions',{token})]).then(([e,d])=>{setExams(e.exams||[]);setItems(d.distributions||[])}).catch(e=>setMessage(e.message));
  useEffect(()=>{refresh()},[token]);
  useEffect(()=>{if(!examId){setRankings([]);return}api(`/admin/prize-rankings?examId=${encodeURIComponent(examId)}`,{token}).then(d=>setRankings(d.rankings||[])).catch(e=>{setRankings([]);setMessage(e.message)})},[examId,token]);
  const eligible=exams.find(e=>e.id===examId), winner=rankings.find(candidate=>candidate.studentId===studentId);
  async function submit(event){event.preventDefault();setMessage('');try{const result=await api('/admin/prize-distributions',{method:'POST',token,body:{examId,studentId,rank:Number(rank)}});setMessage(`Demo award queued: ${result.distribution.amount} DMC. Super Admin approval is required.`);refresh()}catch(e){setMessage(e.message)}}
  async function approve(id){try{await api(`/admin/prize-distributions/${id}/approve`,{method:'POST',token,body:{}});setMessage('Demo credit approved and added to the student ledger.');refresh()}catch(e){setMessage(e.message)}}
  const prizeValue = eligible?.prizeConfig?.[['','first','second','third'][rank]] || 0;
  const simulatedPool = (eligible?.fee || 0) * (eligible?.registered || 0);
  const estimate = eligible?.prizeConfig?.method === 'percentage' ? `${prizeValue}% × ${money(simulatedPool)} pool` : eligible?.prizeConfig?.method === 'multiplier' ? `${prizeValue}× ${money(simulatedPool)} pool` : `${prizeValue} DMC fixed virtual credit`;
  return <Shell title="Prize management" kicker="VIRTUAL AWARD CONTROLS" description="Review configured prize previews and approve non-cash demo credits.">{message&&<div className="alert">{message}</div>}<div className="grid-2"><form className="panel admin-course-form" onSubmit={submit}><div className="panel-head"><div><h3><Trophy size={18}/> Queue a demo award</h3><p className="muted">Uses the exam’s saved prize plan and eligible student list.</p></div></div><label>Examination<select required value={examId} onChange={e=>{setExamId(e.target.value);setStudentId("")}}><option value="">Choose examination</option>{exams.filter(e=>e.prizeConfig?.enabled).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><label>Student<select required value={studentId} onChange={e=>{const candidate=rankings.find(item=>item.studentId===e.target.value);setStudentId(e.target.value);if(candidate)setRank(candidate.rank)}}><option value="">Choose a ranked student</option>{rankings.map(item=><option key={item.studentId} value={item.studentId}>#{item.rank} · {item.name} · {item.score} points</option>)}</select></label><p className="muted">Selected rank: {winner ? `#${winner.rank} · ${winner.score} points · ${winner.accuracy}% accuracy` : "No completed eligible rankings yet"}</p><p className="muted">Estimate: {estimate}. Final amount is recalculated by the server when queued. Credits have no cash value.</p><button className="btn btn-primary" disabled={!examId||!studentId}>Queue for approval</button></form><section className="panel"><div className="panel-head"><h3>Prize distribution queue</h3><span className="demo-pill">Demo only</span></div>{items.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Exam / student</th><th>Rank</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{exams.find(e=>e.id===item.examId)?.title||item.examId}<br/><small>{item.studentName}</small></td><td>{item.rank}</td><td>{item.amount} DMC</td><td>{item.status}</td><td>{user.role==='superadmin'&&item.status==='pending'&&<button className="btn btn-soft small" onClick={()=>approve(item.id)}>Approve</button>}</td></tr>)}</tbody></table></div>:<Empty title="No prize distributions" text="Queue a configured award to begin the approval workflow."/>}</section></div></Shell>
}
export function ManageStudents() {
  const { token } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [error, setError] = useState("");

  const loadStudents = () => {
    setLoading(true);
    api("/admin/students", { token })
      .then((res) => {
        setStudents(res.students || []);
        setError("");
      })
      .catch(() => {
        // Fallback to overview data if students endpoint fails
        api("/admin/overview", { token })
          .then((res) => {
            const list = (res.users || []).filter((u) => u.role === "student");
            setStudents(list);
            setError("");
          })
          .catch((err) => setError(err.message));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStudents();
  }, [token]);

  // Filter students based on search and target examination
  const filteredStudents = useMemo(() => {
    return (students || []).filter((s) => {
      if (targetFilter !== "all" && s.target !== targetFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.name && s.name.toLowerCase().includes(q);
        const matchEmail = s.email && s.email.toLowerCase().includes(q);
        const matchCity = s.city && s.city.toLowerCase().includes(q);
        const matchPhone = s.phone && s.phone.includes(q);
        if (!matchName && !matchEmail && !matchCity && !matchPhone) return false;
      }
      return true;
    });
  }, [students, search, targetFilter]);

  const totalCount = (students || []).length;
  const jeeMainCount = (students || []).filter((s) => s.target === "JEE Main").length;
  const neetCount = (students || []).filter((s) => s.target === "NEET UG").length;
  const jeeAdvCount = (students || []).filter((s) => s.target === "JEE Advanced").length;

  return (
    <Shell
      title="Student Directory & Candidates"
      kicker="PEOPLE & CANDIDATE REGISTRATIONS"
      description="Comprehensive candidate roster, academic targets, exam registrations, and profile dossiers."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline small" onClick={loadStudents}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
          <Link to="/admin/wallets" className="btn btn-primary small">
            <Wallet size={15} /> Student Wallets
          </Link>
        </div>
      }
    >
      {/* 4 Candidate Stats */}
      <div className="grid-4" style={{ marginBottom: 22 }}>
        <Stat
          icon={Users}
          label="Total Candidates"
          value={totalCount}
          tone="default"
          delta="Registered accounts"
        />
        <Stat
          icon={Target}
          label="JEE Main Aspirants"
          value={jeeMainCount}
          tone="blue"
          delta="Engineering entrance"
        />
        <Stat
          icon={GraduationCap}
          label="NEET UG Aspirants"
          value={neetCount}
          tone="green"
          delta="Medical entrance"
        />
        <Stat
          icon={Trophy}
          label="JEE Advanced"
          value={jeeAdvCount}
          tone="purple"
          delta="Elite diagnostic"
        />
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Filter Toolbar */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <input
              type="text"
              placeholder="Search candidate by name, email, city, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", paddingLeft: 12 }}
            />
          </div>
          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="all">All Academic Targets</option>
            <option value="JEE Main">JEE Main</option>
            <option value="NEET UG">NEET UG</option>
            <option value="JEE Advanced">JEE Advanced</option>
          </select>
          {search && (
            <button className="btn btn-soft small" onClick={() => setSearch("")}>
              Clear Search
            </button>
          )}
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Showing <strong>{filteredStudents.length}</strong> of {totalCount} students
          </span>
        </div>
      </div>

      {/* Students Directory Table */}
      {loading ? (
        <Loading />
      ) : filteredStudents.length === 0 ? (
        <Empty
          title="No candidates found"
          text="No student profiles matched your search or target filter criteria."
        />
      ) : (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-scroll">
            <table className="data-table" style={{ width: "100%", margin: 0 }}>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Target Exam</th>
                  <th>City & Year</th>
                  <th>Contact Phone</th>
                  <th>Wallet Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {s.avatar ? (
                          <img
                            src={s.avatar}
                            alt={s.name}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "1px solid #e2e8f0"
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "#3b82f6",
                              color: "#fff",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 700,
                              fontSize: 14
                            }}
                          >
                            {s.name ? s.name.charAt(0) : "S"}
                          </div>
                        )}
                        <div>
                          <strong>{s.name}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="tag"
                        style={{
                          background:
                            s.target === "NEET UG"
                              ? "#ecfdf5"
                              : s.target === "JEE Advanced"
                              ? "#faf5ff"
                              : "#eff6ff",
                          color:
                            s.target === "NEET UG"
                              ? "#047857"
                              : s.target === "JEE Advanced"
                              ? "#6b21a8"
                              : "#1d4ed8",
                          border: `1px solid ${
                            s.target === "NEET UG"
                              ? "#a7f3d0"
                              : s.target === "JEE Advanced"
                              ? "#e9d5ff"
                              : "#bfdbfe"
                          }`,
                          fontWeight: 600
                        }}
                      >
                        {s.target || "JEE Main"}
                      </span>
                    </td>
                    <td>
                      <strong>{s.city || "Pune"}</strong>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Target Year: {s.year || "2026"}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "#475569" }}>
                        {s.phone || "+91 98765 43210"}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: "#059669" }}>
                        {money(s.walletBalance ?? 1500)}
                      </strong>
                    </td>
                    <td>
                      <span className="tag green">● Active</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-soft small"
                        onClick={() => setSelectedStudent(s)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        <Eye size={13} /> View Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Candidate Dossier Modal */}
      {selectedStudent && (
        <div
          className="modal-cover"
          onClick={() => setSelectedStudent(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            className="panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0"
            }}
          >
            <div className="panel-head" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {selectedStudent.avatar ? (
                  <img
                    src={selectedStudent.avatar}
                    alt={selectedStudent.name}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "#2563eb",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      fontSize: 20
                    }}
                  >
                    {selectedStudent.name.charAt(0)}
                  </div>
                )}
                <div>
                  <span className="demo-pill">STUDENT CANDIDATE DOSSIER</span>
                  <h3 style={{ margin: "4px 0 0" }}>{selectedStudent.name}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: 12 }}>{selectedStudent.email}</p>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => setSelectedStudent(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Academic Target
                </span>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, color: "#1e293b" }}>
                  {selectedStudent.target || "JEE Main"}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Location & Year
                </span>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, color: "#1e293b" }}>
                  {selectedStudent.city || "Pune"} · Batch {selectedStudent.year || "2026"}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Contact Phone
                </span>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, color: "#1e293b" }}>
                  {selectedStudent.phone || "+91 98765 43210"}
                </div>
              </div>

              <div style={{ background: "#ecfdf5", padding: 12, borderRadius: 8, border: "1px solid #a7f3d0" }}>
                <span style={{ fontSize: 11, color: "#065f46", textTransform: "uppercase", fontWeight: 700 }}>
                  Wallet Balance
                </span>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, color: "#047857" }}>
                  {money(selectedStudent.walletBalance ?? 1500)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, background: "#f1f5f9", padding: 14, borderRadius: 8, fontSize: 13, color: "#334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Account Status:</span>
                <strong style={{ color: "#15803d" }}>Active & Verified</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Registered Tests:</span>
                <strong>{selectedStudent.registeredExamsCount || 2} Active Registrations</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Member Since:</span>
                <span>{selectedStudent.createdAt ? new Date(selectedStudent.createdAt).toLocaleDateString("en-IN") : "Sep 2026"}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 }}>
              <Link
                to="/admin/wallets"
                className="btn btn-outline small"
                onClick={() => setSelectedStudent(null)}
              >
                Inspect in Finance Console →
              </Link>
              <button
                className="btn btn-primary small"
                onClick={() => setSelectedStudent(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
export function ManagePapers() {
  const { data, refresh, token } = useOverview();
  const [msg, setMsg] = useState("");
  async function approve(id) {
    try {
      await api("/admin/papers/approve", {
        method: "POST",
        token,
        body: { id },
      });
      setMsg("Paper approved");
      refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }
  return (
    <Shell
      title="Paper review queue"
      kicker="QUALITY ASSURANCE"
      description="Independent review keeps examination content consistent."
    >
      {msg && <div className="alert">{msg}</div>}
      {!data ? (
        <Loading />
      ) : (
        <div className="panel">
          {data.papers.length ? (
            <PaperTable papers={data.papers} approve={approve} />
          ) : (
            <Empty
              title="Review queue is clear"
              text="Teachers can submit demo papers for review."
            />
          )}
        </div>
      )}
    </Shell>
  );
}

export function ManageQuestionBanks() {
  const { token } = useAuth();
  const [banks, setBanks] = useState(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [patterns, setPatterns] = useState([]);
  const [courses, setCourses] = useState([]);
  const [publishOptions, setPublishOptions] = useState({ patternId: '', courseId: '', importMode: 'compatible_practice', isFree: true, price: 0 });
  const refresh = () => api("/teacher/question-banks", { token }).then((data) => setBanks(data.banks)).catch((error) => setMessage(error.message));
  useEffect(() => { refresh(); Promise.all([api('/exam-patterns', { token }), api('/admin/courses', { token })]).then(([patternData, courseData]) => { setPatterns(patternData.patterns); setCourses(courseData.courses); setPublishOptions((current) => ({ ...current, patternId: current.patternId || patternData.patterns.find((item) => item.status === 'active')?.id || '' })); }).catch((error) => setMessage(error.message)); }, [token]);
  async function preview(id) { setBusy(true); try { const data = await api(`/teacher/question-banks/${id}`, { token }); setSelected(data.bank); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  async function approve(id) {
    setBusy(true);
    try { await api("/admin/question-banks/approve", { method: "POST", token, body: { id } }); setMessage("Question bank approved. It is ready for publication."); setSelected(null); refresh(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function reject(id) { const reason = window.prompt('Enter the rejection reason for the teacher:'); if (!reason?.trim()) return; setBusy(true); try { await api('/admin/question-banks/reject', { method: 'POST', token, body: { id, reason } }); setMessage('Paper rejected with a reason.'); setSelected(null); refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  async function publish(id) { if (!publishOptions.patternId) { setMessage('Select an examination pattern before publishing.'); return; } setBusy(true); try { const data = await api('/admin/question-banks/publish', { method: 'POST', token, body: { id, ...publishOptions, courseId: publishOptions.courseId || null, price: publishOptions.isFree ? 0 : Number(publishOptions.price) } }); setMessage(`Examination published with ID ${data.examId}.`); setSelected(null); refresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  return <Shell title="Question paper approval" kicker="CONTENT APPROVAL" description="Preview every imported question, approve or reject it, then publish the approved paper as a student examination.">{message && <div className="alert" role="status">{message}</div>}<div className="panel" style={{ marginBottom: 18 }}><h3>Publication configuration</h3><div className="admin-form-grid"><label>Exam pattern<select value={publishOptions.patternId} onChange={(event) => setPublishOptions({ ...publishOptions, patternId: event.target.value })}><option value="">Select pattern</option>{patterns.filter((item) => item.status === 'active').map((item) => <option value={item.id} key={item.id}>{item.name} · v{item.version}</option>)}</select></label><label>Course<select value={publishOptions.courseId} onChange={(event) => setPublishOptions({ ...publishOptions, courseId: event.target.value })}><option value="">No course</option>{courses.filter((item) => item.status !== 'archived').map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Validation mode<select value={publishOptions.importMode} onChange={(event) => setPublishOptions({ ...publishOptions, importMode: event.target.value })}><option value="compatible_practice">Compatible practice</option><option value="strict_standard">Strict standard</option></select></label><label>Access<select value={publishOptions.isFree ? 'free' : 'paid'} onChange={(event) => setPublishOptions({ ...publishOptions, isFree: event.target.value === 'free' })}><option value="free">Free</option><option value="paid">Paid (requires payment provider)</option></select></label></div><p className="muted">Strict mode blocks publication unless question counts, native types, subjects, and paper metadata exactly match the selected pattern.</p></div>{!banks ? <Loading/> : <div className="panel">{banks.filter((bank) => ['submitted', 'approved'].includes(bank.status)).length ? banks.filter((bank) => ['submitted', 'approved'].includes(bank.status)).map((bank) => <div className="bank-approval-row" key={bank.id}><div><strong>{bank.title}</strong><small>{bank.questionCount} questions · {bank.subject} · {bank.importMode?.replaceAll('_', ' ')} · submitted by {bank.teacherName || bank.createdBy} · {bank.status}</small></div><button className="btn btn-soft small" disabled={busy} onClick={() => preview(bank.id)}>Preview Paper</button>{bank.status === 'submitted' ? <><button className="btn btn-primary small" disabled={busy} onClick={() => approve(bank.id)}>Approve</button><button className="btn btn-outline small" disabled={busy} onClick={() => reject(bank.id)}>Reject</button></> : <button className="btn btn-primary small" disabled={busy} onClick={() => publish(bank.id)}>Publish Examination</button>}</div>) : <Empty title="Review queue is clear" text="Submitted question papers will appear here."/>}<h3 style={{ marginTop: 28 }}>All question banks</h3><BankTable banks={banks}/></div>}{selected && <div className="modal-cover"><div className="student-preview-modal"><button className="preview-close" onClick={() => setSelected(null)} aria-label="Close preview">×</button><span className="eyebrow">ADMIN REVIEW · {selected.questions.length} QUESTIONS</span><h2>{selected.title}</h2><p className="muted">Teacher: {selected.teacherName || selected.createdBy} · Subjects: {[...new Set(selected.questions.map((q) => q.subject))].join(', ')}</p>{selected.sourceLimitations?.length > 0 && <div className="alert">{selected.sourceLimitations.join(' ')}</div>}{selected.questions.map((question, index) => <article className="question-editor" key={question.id}><strong>Question {index + 1} · {question.questionType.replaceAll('_', ' ')}</strong><QuestionRenderer question={question} selected={question.questionType.includes('numerical') ? question.numericalAnswer : question.correctOptions} disabled showAnswer/><p><b>Correct answer:</b> {question.questionType.includes('numerical') ? question.numericalAnswer : question.correctOptions.map((value) => String.fromCharCode(65 + value)).join(', ')}</p>{question.explanation && <p><b>Explanation:</b> {question.explanation}</p>}</article>)}</div></div>}</Shell>;
}
export function ManageSupport() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState(null);
  useEffect(() => {
    api("/admin/tickets", { token })
      .then((d) => setTickets(d.tickets))
      .catch(() => setTickets([]));
  }, [token]);
  return (
    <Shell
      title="Support tickets"
      kicker="CUSTOMER EXPERIENCE"
      description="Review support queries from registered users."
    >
      {!tickets ? (
        <Loading />
      ) : (
        <div className="panel">
          {tickets.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td>{t.subject}</td>
                      <td>{t.message}</td>
                      <td>{t.status}</td>
                      <td>{new Date(t.createdAt).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="All caught up" text="No support requests yet." />
          )}
        </div>
      )}
    </Shell>
  );
}

const emptyCourse = { slug: '', name: '', category: 'Engineering Entrance', examType: 'JEE Main', shortDescription: '', fullDescription: '', imageUrl: null, bannerImageUrl: null, fee: 0, discountPercent: 0, durationDays: 180, mockTestCount: 1, status: 'draft', visible: true, featured: false, displayOrder: 0 };

function ArtworkField({ label, value, busy, onChoose, onRemove }) {
  return <div className="admin-artwork-field"><span>{label}</span>{value ? <div className="admin-artwork-preview"><img src={value} alt={`${label} preview`}/><button type="button" className="btn btn-outline small" onClick={onRemove}><X size={14}/> Remove</button></div> : <div className="admin-artwork-empty"><ImagePlus size={23}/><small>No image selected</small></div>}<label className={`btn btn-soft small admin-upload-button ${busy ? 'disabled' : ''}`}><UploadCloud size={15}/> {busy ? 'Optimizing…' : 'Upload image'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onChoose(file); }}/></label><small>JPG, PNG, or WebP. Images are resized to 1600 × 900 and optimized before saving.</small></div>;
}

export function ManageCourses() {
  return <Navigate to="/admin/exams" replace />;
}

export function PlatformConfiguration() {
  const { token } = useAuth();
  const [patterns, setPatterns] = useState(null), [content, setContent] = useState({ heading: '', description: '', buttonLabel: '', visible: true }), [message, setMessage] = useState('');
  const [patternForm, setPatternForm] = useState({ code: '', name: '', officialYear: 2026, status: 'draft', configuration: '{\n  "durationMinutes": 180,\n  "questionCount": 0,\n  "maximumMarks": 0,\n  "subjects": [],\n  "rules": {}\n}' });
  const refreshPatterns = () => api('/exam-patterns', { token }).then((data) => setPatterns(data.patterns));
  useEffect(() => { Promise.all([api('/exam-patterns', { token }), api('/landing-content')]).then(([patternData, landingData]) => { setPatterns(patternData.patterns); setContent((current) => ({ ...current, ...(landingData.payload || landingData.content?.about_courses || {}) })); }).catch((error) => setMessage(error.message)); }, [token]);
  async function save(event) { event.preventDefault(); try { await api('/admin/landing-content/about_courses', { method: 'PUT', token, body: content }); setMessage('Landing content updated.'); } catch (error) { setMessage(error.message); } }
  async function createPattern(event) { event.preventDefault(); try { const configuration = JSON.parse(patternForm.configuration); await api('/admin/exam-patterns', { method: 'POST', token, body: { ...patternForm, officialYear: Number(patternForm.officialYear), configuration } }); setMessage('New immutable pattern version created.'); refreshPatterns(); } catch (error) { setMessage(error instanceof SyntaxError ? 'Pattern configuration must be valid JSON.' : error.message); } }
  
  function handleResetDemoData() {
    if (window.confirm('Reset all demo data (exams, courses, questions, wallets, attempts) to default initial seed state?')) {
      localStorage.clear();
      window.location.reload();
    }
  }

  return <Shell title="Platform configuration" kicker="PATTERNS & LANDING" description="Review versioned exam definitions, manage public landing sections, and manage local storage demo data.">
    {message && <div className="alert">{message}</div>}
    
    <div className="panel" style={{ marginBottom: 20, borderLeft: '4px solid #2563eb' }}>
      <div className="panel-head">
        <div>
          <h3>Frontend Standalone Demo Architecture</h3>
          <p className="muted">This application runs completely in client-only mode with persistent localStorage and modular services.</p>
        </div>
        <button type="button" className="btn btn-outline danger small" onClick={handleResetDemoData}>
          <RotateCcw size={14} /> Reset Demo Data to Defaults
        </button>
      </div>
    </div>

    <div className="grid-2">
      <div className="panel">
        <h3>Versioned exam patterns</h3>
        {!patterns ? <Loading/> : patterns.map((item) => <div className="admin-row" key={item.id}>
          <div>
            <strong>{item.name}</strong>
            <small>{item.code} · version {item.version} · {item.configuration.questionCount} questions · {item.configuration.durationMinutes} minutes</small>
          </div>
          <span className={`tag ${item.status === 'active' ? 'green' : ''}`}>{item.status}</span>
        </div>)}
        <div className="alert">Published exams retain a configuration snapshot, so later pattern versions never alter attempts already in progress.</div>
      </div>
      <form className="panel admin-course-form" onSubmit={createPattern}>
        <h3>Create pattern version</h3>
        <label>Stable code<input required pattern="[a-z0-9-]+" value={patternForm.code} onChange={(e) => setPatternForm({ ...patternForm, code: e.target.value })}/></label>
        <label>Name<input required value={patternForm.name} onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })}/></label>
        <div className="admin-form-grid">
          <label>Official year<input type="number" value={patternForm.officialYear} onChange={(e) => setPatternForm({ ...patternForm, officialYear: e.target.value })}/></label>
          <label>Status<select value={patternForm.status} onChange={(e) => setPatternForm({ ...patternForm, status: e.target.value })}><option value="draft">Draft</option><option value="active">Active</option></select></label>
        </div>
        <label>Configuration JSON<textarea rows="12" spellCheck="false" value={patternForm.configuration} onChange={(e) => setPatternForm({ ...patternForm, configuration: e.target.value })}/></label>
        <button className="btn btn-primary">Create new version</button>
      </form>
      <form className="panel admin-course-form" onSubmit={save}>
        <h3>“About Our Courses” section</h3>
        <label>Heading<input value={content.heading} onChange={(e) => setContent({ ...content, heading: e.target.value })}/></label>
        <label>Description<textarea rows="5" value={content.description} onChange={(e) => setContent({ ...content, description: e.target.value })}/></label>
        <label>Button label<input value={content.buttonLabel} onChange={(e) => setContent({ ...content, buttonLabel: e.target.value })}/></label>
        <label><input type="checkbox" checked={content.visible} onChange={(e) => setContent({ ...content, visible: e.target.checked })}/> Visible</label>
        <button className="btn btn-primary">Save landing content</button>
      </form>
    </div>
  </Shell>;
}

export function ManageQuestions() {
  const [questions, setQuestions] = useState(null);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null); // null, 'new', or question object

  const emptyQ = {
    subject: 'Physics',
    chapter: '',
    difficulty: 'Medium',
    questionType: 'single_correct',
    text: '',
    options: ['', '', '', ''],
    answer: 0,
    explanation: ''
  };
  const [form, setForm] = useState(emptyQ);

  const refresh = () => {
    api('/questions').then((data) => setQuestions(data.questions || [])).catch((e) => setMessage(e.message));
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredQuestions = useMemo(() => {
    if (!questions) return [];
    return questions.filter((q) => {
      const matchSub = !subjectFilter || q.subject?.toLowerCase() === subjectFilter.toLowerCase();
      const matchDiff = !difficultyFilter || q.difficulty?.toLowerCase() === difficultyFilter.toLowerCase();
      const matchSearch = !search || q.text?.toLowerCase().includes(search.toLowerCase()) || q.chapter?.toLowerCase().includes(search.toLowerCase());
      return matchSub && matchDiff && matchSearch;
    });
  }, [questions, search, subjectFilter, difficultyFilter]);

  const handleEdit = (q) => {
    setEditing(q);
    setForm({
      subject: q.subject || 'Physics',
      chapter: q.chapter || '',
      difficulty: q.difficulty || 'Medium',
      questionType: q.questionType || 'single_correct',
      text: q.text || '',
      options: q.options ? [...q.options] : ['', '', '', ''],
      answer: q.answer ?? q.correctOption ?? 0,
      explanation: q.explanation || ''
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      if (editing && editing !== 'new') {
        await questionService.updateQuestion(editing.id, form);
        setMessage(`Question #${editing.id} updated successfully.`);
      } else {
        await questionService.createQuestion(form);
        setMessage('New MCQ question added to bank successfully.');
      }
      setEditing(null);
      setForm(emptyQ);
      refresh();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleDelete = async (qId) => {
    if (!window.confirm('Delete this question from the question bank?')) return;
    try {
      await questionService.deleteQuestion(qId);
      setMessage(`Question #${qId} deleted.`);
      refresh();
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <Shell
      title="Question Bank Management"
      kicker="ACADEMIC CONTENT"
      description="Add, edit, delete and organize MCQs across Physics, Chemistry, Mathematics and Biology with full LaTeX math equation support."
      action={
        <button
          className="btn btn-primary small"
          onClick={() => {
            setEditing('new');
            setForm(emptyQ);
          }}
        >
          <Plus size={15} /> Add New Question
        </button>
      }
    >
      {message && <div className="alert">{message}</div>}

      {/* Editor Modal / Panel */}
      {editing && (
        <div className="panel" style={{ marginBottom: 24, border: '2px solid #2563eb' }}>
          <div className="panel-head">
            <div>
              <h3>{editing === 'new' ? 'Create New Question' : `Edit Question #${editing.id}`}</h3>
              <p className="muted">Specify question text, mathematical LaTeX formatting, choices, and verified explanation.</p>
            </div>
            <button className="btn btn-outline small" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} className="admin-course-form">
            <div className="admin-form-grid">
              <label>
                Subject
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  <option>Physics</option>
                  <option>Chemistry</option>
                  <option>Mathematics</option>
                  <option>Biology</option>
                </select>
              </label>
              <label>
                Chapter / Topic
                <input
                  required
                  placeholder="e.g. Thermodynamics, Optics"
                  value={form.chapter}
                  onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                />
              </label>
              <label>
                Difficulty
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </label>
              <label>
                Question Type
                <select value={form.questionType} onChange={(e) => setForm({ ...form, questionType: e.target.value })}>
                  <option value="single_correct">Single Choice (1 Correct)</option>
                  <option value="multiple_correct">Multiple Choice</option>
                  <option value="numerical">Numerical Value</option>
                </select>
              </label>
            </div>

            <label>
              Question Statement (Supports LaTeX math using $...$ or $$...$$)
              <textarea
                required
                rows="3"
                placeholder="Enter complete question statement. E.g. What is the value of $\int_0^{\pi} \sin(x)dx$?"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </label>

            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Answer Options & Correct Key</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {form.options.map((opt, oIdx) => (
                  <div key={oIdx} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: form.answer === oIdx ? '2px solid #10b981' : '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>Option {String.fromCharCode(65 + oIdx)}</span>
                      <label style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="radio"
                          name="correct-opt"
                          checked={form.answer === oIdx}
                          onChange={() => setForm({ ...form, answer: oIdx })}
                        /> Correct Answer
                      </label>
                    </div>
                    <input
                      required
                      placeholder={`Text for Option ${String.fromCharCode(65 + oIdx)}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...form.options];
                        next[oIdx] = e.target.value;
                        setForm({ ...form, options: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <label style={{ marginTop: 12 }}>
              Detailed Solution & Explanation
              <textarea
                rows="3"
                placeholder="Step-by-step reasoning shown to students after test completion."
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              />
            </label>

            {/* Live Math / Question Preview */}
            {form.text && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, marginTop: 12 }}>
                <strong style={{ display: 'block', fontSize: 11, color: '#166534', textTransform: 'uppercase', marginBottom: 6 }}>Live Preview</strong>
                <QuestionRenderer
                  question={{ ...form, id: 99999 }}
                  selected={form.answer}
                  disabled={true}
                  showAnswer={true}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                {editing === 'new' ? 'Save & Add to Bank' : 'Update Question'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions Search & Filter Bar */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              placeholder="Search by question text or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} style={{ width: 140 }}>
            <option value="">All Subjects</option>
            <option>Physics</option>
            <option>Chemistry</option>
            <option>Mathematics</option>
            <option>Biology</option>
          </select>
          <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} style={{ width: 140 }}>
            <option value="">All Difficulties</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Showing <strong>{filteredQuestions.length}</strong> questions
          </span>
        </div>
      </div>

      {/* Questions Table */}
      {!questions ? (
        <Loading />
      ) : filteredQuestions.length === 0 ? (
        <Empty title="No questions found" text="No question matched your filter criteria." />
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>#</th>
                <th style={{ padding: '12px 16px' }}>Subject & Topic</th>
                <th style={{ padding: '12px 16px' }}>Question Preview</th>
                <th style={{ padding: '12px 16px' }}>Difficulty</th>
                <th style={{ padding: '12px 16px' }}>Correct Key</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>{item.id}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <strong>{item.subject}</strong>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{item.chapter}</div>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 380 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.text}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`tag ${item.difficulty === 'Easy' ? 'green' : item.difficulty === 'Hard' ? 'danger' : ''}`}>
                      {item.difficulty}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4 }}>
                      Option {String.fromCharCode(65 + (item.answer ?? item.correctOption ?? 0))}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button className="btn btn-soft small" onClick={() => handleEdit(item)}>
                        Edit
                      </button>
                      <button className="btn btn-outline danger small" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

/* ==========================================================================
   Exam Registrations & Participation Management
   ========================================================================== */
export function ExamRegistrations() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedExam, setSelectedExam] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = () => {
    setLoading(true);
    api(`/admin/registrations?examId=${selectedExam === "all" ? "" : selectedExam}`, { token })
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token, selectedExam]);

  const items = useMemo(() => {
    if (!data?.registrations) return [];
    return data.registrations.filter((r) => {
      const matchSearch =
        !search ||
        r.studentName?.toLowerCase().includes(search.toLowerCase()) ||
        r.studentEmail?.toLowerCase().includes(search.toLowerCase()) ||
        r.examTitle?.toLowerCase().includes(search.toLowerCase()) ||
        r.registrationId?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.participationStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  return (
    <Shell
      title="Examination Registrations"
      kicker="STUDENT CANDIDATE ROSTER"
      description="Real-time visibility into student exam registrations, wallet payment status, and assessment participation."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-soft small" onClick={loadData}>
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/admin/exams" className="btn btn-primary small">
            Manage Examinations <ArrowUpRight size={14} />
          </Link>
        </div>
      }
    >
      {error && <div className="alert error">{error}</div>}

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <Stat
          icon={ListChecks}
          label="Total Registrations"
          value={data?.totalRegistrations || 0}
          delta="Enrolled candidates"
        />
        <Stat
          icon={Wallet}
          label="Registration Revenue"
          value={money(data?.totalRevenue || 0)}
          tone="green"
          delta="Deducted via wallet"
        />
        <Stat
          icon={Users}
          label="Candidates Started"
          value={data?.startedCount || 0}
          tone="cyan"
          delta="Live or attempted"
        />
        <Stat
          icon={Trophy}
          label="Completed & Evaluated"
          value={data?.completedCount || 0}
          tone="purple"
          delta="Submissions recorded"
        />
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3>Candidate Registration Ledger</h3>
            <p className="muted">Filtered by examination and participation state.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", minWidth: 220 }}>
              <input
                type="text"
                placeholder="Search candidate, email, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "7px 12px", fontSize: 13 }}
              />
            </div>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              style={{ padding: "7px 12px", fontSize: 13 }}
              aria-label="Filter by examination"
            >
              <option value="all">All Examinations</option>
              {(data?.exams || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "7px 12px", fontSize: 13 }}
              aria-label="Filter by participation status"
            >
              <option value="all">All Participation Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reg ID</th>
                  <th>Candidate</th>
                  <th>Examination</th>
                  <th>Registered At</th>
                  <th>Fee Paid</th>
                  <th>Payment</th>
                  <th>Participation Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{String(r.registrationId).slice(0, 12)}</code>
                    </td>
                    <td>
                      <strong>{r.studentName}</strong>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{r.studentEmail}</div>
                    </td>
                    <td>
                      <strong>{r.examTitle}</strong>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {r.registrationDate ? new Date(r.registrationDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      }) : "N/A"}
                    </td>
                    <td>
                      <strong style={{ color: r.amountPaid > 0 ? "#0f172a" : "#10b981" }}>
                        {r.amountPaid ? money(r.amountPaid) : "FREE"}
                      </strong>
                    </td>
                    <td>
                      <span className="tag green">Successful</span>
                    </td>
                    <td>
                      {r.participationStatus === "COMPLETED" ? (
                        <span className="tag green">
                          ✓ Completed ({r.score}/{r.totalMarks})
                        </span>
                      ) : r.participationStatus === "IN_PROGRESS" ? (
                        <span className="tag orange">● In Progress</span>
                      ) : r.participationStatus === "TERMINATED" ? (
                        <span className="tag danger">⚠️ Terminated</span>
                      ) : (
                        <span className="tag gray">○ Not Attempted</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.participationStatus === "COMPLETED" ? (
                        <Link
                          to={`/admin/leaderboards?examId=${r.examId}`}
                          className="btn btn-soft small"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <Trophy size={13} /> Rank
                        </Link>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>Registered</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No registrations found"
            text="No candidate registrations match the selected examination or status filters."
          />
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Admin Wallet Transactions Ledger
   ========================================================================== */
export function AdminWalletTransactions() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  const loadData = () => {
    setLoading(true);
    api(`/admin/transactions?type=${type}&search=${encodeURIComponent(search)}`, { token })
      .then((res) => {
        setData(res);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token, type]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  return (
    <Shell
      title="Wallet Transactions Ledger"
      kicker="FINANCIAL AUDIT & STUDENT WALLETS"
      description="All student wallet credits, examination registration debits, and simulated deposit ledger records."
      action={
        <button className="btn btn-soft small" onClick={loadData}>
          <RefreshCw size={14} /> Refresh Ledger
        </button>
      }
    >
      {error && <div className="alert error">{error}</div>}

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <Stat
          icon={Wallet}
          label="Total Ledger Volume"
          value={money(data?.volume || 0)}
          delta="All system movements"
        />
        <Stat
          icon={TrendingUp}
          label="Registration Debits"
          value={money(data?.totalDebits || 0)}
          tone="cyan"
          delta="Revenue collected"
        />
        <Stat
          icon={Plus}
          label="Deposits & Credits"
          value={money(data?.totalCredits || 0)}
          tone="green"
          delta="Wallet recharges"
        />
        <Stat
          icon={ClipboardList}
          label="Transaction Records"
          value={data?.totalTransactions || 0}
          delta="Persistent entries"
        />
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3>All Student Transactions</h3>
            <p className="muted">Transparent transaction log with before/after balances.</p>
          </div>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search candidate, exam, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "7px 12px", fontSize: 13, minWidth: 220 }}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ padding: "7px 12px", fontSize: 13 }}
              aria-label="Filter transaction type"
            >
              <option value="all">All Types</option>
              <option value="debit">Registration Debits</option>
              <option value="credit">Deposits / Credits</option>
            </select>
            <button type="submit" className="btn btn-primary small">
              <Search size={14} /> Filter
            </button>
          </form>
        </div>

        {loading ? (
          <Loading />
        ) : data?.transactions?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tx ID</th>
                  <th>Date & Time</th>
                  <th>Candidate</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => {
                  const isDebit = tx.transactionType === "debit" || tx.type === "debit";
                  return (
                    <tr key={tx.id}>
                      <td>
                        <code>{String(tx.id || tx.transactionId).slice(0, 12)}</code>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {new Date(tx.timestamp || tx.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td>
                        <strong>{tx.studentName || "Candidate"}</strong>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {tx.memo || tx.description || (tx.examTitle ? `Exam Fee: ${tx.examTitle}` : "Wallet Operation")}
                      </td>
                      <td>
                        <span className={`tag ${isDebit ? "orange" : "green"}`}>
                          {isDebit ? "Debit (Fee)" : "Credit (Top-Up)"}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: isDebit ? "#ef4444" : "#10b981", fontSize: 14 }}>
                          {isDebit ? "-" : "+"}
                          {money(tx.amount)}
                        </strong>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {tx.balanceAfter !== undefined ? money(tx.balanceAfter) : "—"}
                      </td>
                      <td>
                        <span className="tag green">Successful</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No transactions recorded"
            text="No wallet transactions match your search criteria."
          />
        )}
      </div>
    </Shell>
  );
}
