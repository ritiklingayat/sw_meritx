import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Clock3,
  CheckCircle2,
  Target,
  TrendingUp,
  Users,
  Search,
  ArrowUpRight,
  Sparkles,
  Calendar,
  Play
} from "lucide-react";
import { Shell, Stat, Loading, Empty } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, friendlyDate } from "../../lib/api";
import "./StudentLeaderboard.css";

export default function StudentLeaderboard() {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(searchParams.get("examId") || "");
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Load available exams
  useEffect(() => {
    api("/exams")
      .then((res) => {
        const list = res.exams || [];
        setExams(list);
        if (!selectedExamId && list.length > 0) {
          const initialId = searchParams.get("examId") || list[0].id;
          setSelectedExamId(initialId);
        }
      })
      .catch((err) => setError("Failed to load examinations: " + err.message));
  }, []);

  // Sync URL when exam changes
  const handleExamChange = (newExamId) => {
    setSelectedExamId(newExamId);
    setSearchParams({ examId: newExamId });
  };

  // Fetch leaderboard data for selected exam
  useEffect(() => {
    if (!selectedExamId) return;
    setLoading(true);
    setError("");

    api(`/leaderboard/${selectedExamId}`, { token })
      .then((data) => {
        setLeaderboard(data);
      })
      .catch((err) => {
        setError("Failed to load leaderboard rankings: " + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedExamId, token]);

  const activeExam = exams.find((e) => e.id === selectedExamId) || {
    title: "National Assessment",
    subject: "Competitive Test",
    duration: 180,
    marks: 300
  };

  const currentRank = leaderboard?.currentStudentRank;
  const rankings = leaderboard?.rankings || [];

  // Filter rankings by search query
  const filteredRankings = rankings.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.studentName && r.studentName.toLowerCase().includes(q)) ||
      (r.studentCity && r.studentCity.toLowerCase().includes(q)) ||
      (r.studentEmail && r.studentEmail.toLowerCase().includes(q))
    );
  });

  return (
    <Shell
      title="Examination Leaderboards"
      kicker="OFFICIAL COMPETITIVE MERIT RANKINGS"
      description="Deterministic, real-time national percentile and merit ranking based on score, accuracy, and completion time."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Link to={`/take/${selectedExamId}`} className="btn btn-primary small">
            <Play size={15} fill="currentColor" /> Take This Exam
          </Link>
          <Link to="/student/results" className="btn btn-outline small">
            My Past Results <ArrowUpRight size={15} />
          </Link>
        </div>
      }
    >
      <div className="leaderboard-container">
        {/* Controls Bar: Exam Selector */}
        <div className="leaderboard-controls-bar">
          <div className="exam-selector-wrap">
            <label htmlFor="exam-select">
              <Trophy size={16} color="#2563eb" /> Select Examination:
            </label>
            <select
              id="exam-select"
              className="exam-select-dropdown"
              value={selectedExamId}
              onChange={(e) => handleExamChange(e.target.value)}
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.subject || "All Subjects"})
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 13, color: "#64748b" }}>
            Marks: <strong>{activeExam.marks || 300}</strong> · Duration: <strong>{activeExam.duration || 180} Mins</strong>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <Loading />
        ) : (
          <>
            {/* 4 Summary Stats */}
            <div className="grid-4">
              <Stat
                icon={Users}
                label="Total Participants"
                value={leaderboard?.totalParticipants || 0}
                tone="purple"
                delta="Verified attempts"
              />
              <Stat
                icon={Trophy}
                label="Highest Score"
                value={`${leaderboard?.highestScore || 0}/${activeExam.marks || 300}`}
                tone="green"
                delta="Rank #1 Benchmark"
              />
              <Stat
                icon={Target}
                label="Average Score"
                value={`${leaderboard?.averageScore || 0}/${activeExam.marks || 300}`}
                tone="cyan"
                delta="Cohort mean"
              />
              <Stat
                icon={TrendingUp}
                label="Passing Accuracy"
                value="68%"
                tone="default"
                delta="Minimum qualification"
              />
            </div>

            {/* Candidate Personal Ranking Banner */}
            {currentRank ? (
              <div className="candidate-rank-banner">
                <div className="candidate-rank-info">
                  <span className="rank-kicker">
                    <Sparkles size={14} /> YOUR VERIFIED MERIT RANKING
                  </span>
                  <h3 className="rank-title">
                    {user?.name}, you are currently ranked #{currentRank.rank} of {leaderboard.totalParticipants} candidates!
                  </h3>
                  <div className="rank-stats-pills">
                    <span className="rank-stat-pill">
                      Score: <strong>{currentRank.score} / {currentRank.maximumMarks}</strong> ({currentRank.percentage}%)
                    </span>
                    <span className="rank-stat-pill">
                      Accuracy: <strong>{currentRank.accuracy}%</strong>
                    </span>
                    <span className="rank-stat-pill">
                      Time Taken: <strong>{currentRank.formattedTime}</strong>
                    </span>
                    <span className="rank-stat-pill">
                      Submitted: <strong>{new Date(currentRank.submittedAt).toLocaleDateString("en-IN")}</strong>
                    </span>
                  </div>
                </div>

                <div className="rank-huge-badge">
                  <div className={`rank-number-box ${currentRank.rank <= 3 ? "top3" : ""}`}>
                    <small>Official Rank</small>
                    <strong>#{currentRank.rank}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="candidate-rank-banner unattempted">
                <div className="candidate-rank-info">
                  <span className="rank-kicker" style={{ color: "#ffffff" }}>
                    <Sparkles size={14} /> PARTICIPATION PENDING
                  </span>
                  <h3 className="rank-title">You have not attempted this examination yet!</h3>
                  <p style={{ margin: "4px 0 0", color: "#e0e7ff", fontSize: 14 }}>
                    Compete with peers and check your national percentile ranking upon completion.
                  </p>
                </div>
                <Link to={`/take/${selectedExamId}`} className="btn btn-white">
                  <Play size={15} fill="currentColor" /> Start Examination Now
                </Link>
              </div>
            )}

            {/* Top 3 Podium Cards */}
            {leaderboard?.topThree && leaderboard.topThree.length > 0 && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <Crown size={18} color="#f59e0b" /> Top Performers Podium
                </h3>

                <div className="podium-section">
                  {/* Rank 2 (Silver) */}
                  {leaderboard.topThree[1] ? (
                    <div className="podium-card rank-2">
                      <div className="podium-badge">🥈 2nd Place</div>
                      <div className="podium-avatar">
                        {leaderboard.topThree[1].studentName?.charAt(0) || "B"}
                      </div>
                      <div className="podium-name">{leaderboard.topThree[1].studentName}</div>
                      <div className="podium-meta">{leaderboard.topThree[1].studentCity || "Pune"} · Candidate</div>
                      <div className="podium-score-box">
                        <div className="podium-score-item">
                          <small>Score</small>
                          <strong>{leaderboard.topThree[1].score}/{leaderboard.topThree[1].maximumMarks}</strong>
                        </div>
                        <div className="podium-score-item">
                          <small>Accuracy</small>
                          <strong>{leaderboard.topThree[1].accuracy}%</strong>
                        </div>
                      </div>
                    </div>
                  ) : <div className="podium-card rank-2" style={{ opacity: 0.5 }}>Pending candidate</div>}

                  {/* Rank 1 (Gold) */}
                  {leaderboard.topThree[0] ? (
                    <div className="podium-card rank-1">
                      <div className="podium-badge">🥇 1st Place (Winner)</div>
                      <div className="podium-avatar">
                        <Crown size={22} style={{ position: "absolute", top: -14, color: "#f59e0b" }} />
                        {leaderboard.topThree[0].studentName?.charAt(0) || "A"}
                      </div>
                      <div className="podium-name">{leaderboard.topThree[0].studentName}</div>
                      <div className="podium-meta">{leaderboard.topThree[0].studentCity || "Mumbai"} · Candidate</div>
                      <div className="podium-score-box">
                        <div className="podium-score-item">
                          <small>Score</small>
                          <strong>{leaderboard.topThree[0].score}/{leaderboard.topThree[0].maximumMarks}</strong>
                        </div>
                        <div className="podium-score-item">
                          <small>Accuracy</small>
                          <strong>{leaderboard.topThree[0].accuracy}%</strong>
                        </div>
                      </div>
                    </div>
                  ) : <div className="podium-card rank-1" style={{ opacity: 0.5 }}>Pending candidate</div>}

                  {/* Rank 3 (Bronze) */}
                  {leaderboard.topThree[2] ? (
                    <div className="podium-card rank-3">
                      <div className="podium-badge">🥉 3rd Place</div>
                      <div className="podium-avatar">
                        {leaderboard.topThree[2].studentName?.charAt(0) || "C"}
                      </div>
                      <div className="podium-name">{leaderboard.topThree[2].studentName}</div>
                      <div className="podium-meta">{leaderboard.topThree[2].studentCity || "Nagpur"} · Candidate</div>
                      <div className="podium-score-box">
                        <div className="podium-score-item">
                          <small>Score</small>
                          <strong>{leaderboard.topThree[2].score}/{leaderboard.topThree[2].maximumMarks}</strong>
                        </div>
                        <div className="podium-score-item">
                          <small>Accuracy</small>
                          <strong>{leaderboard.topThree[2].accuracy}%</strong>
                        </div>
                      </div>
                    </div>
                  ) : <div className="podium-card rank-3" style={{ opacity: 0.5 }}>Pending candidate</div>}
                </div>
              </div>
            )}

            {/* Detailed Rankings Table */}
            <div className="leaderboard-table-card">
              <div className="leaderboard-table-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Complete Merit Table</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                    Showing {filteredRankings.length} of {rankings.length} participant rankings
                  </p>
                </div>

                <div className="search-input-wrap">
                  <Search size={15} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search candidate name or city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {filteredRankings.length === 0 ? (
                <Empty title="No Candidates Found" text="No candidates matched your search query." />
              ) : (
                <div className="leaderboard-table-container">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>Rank</th>
                        <th>Candidate Name</th>
                        <th>City</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Accuracy</th>
                        <th>Time Taken</th>
                        <th>Submitted Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRankings.map((r) => {
                        const isCurrent = r.isCurrentStudent;
                        return (
                          <tr key={r.id || r.studentId} className={isCurrent ? "current-user-row" : ""}>
                            <td>
                              <div className="rank-cell">
                                <span
                                  className={`rank-circle ${
                                    r.rank === 1
                                      ? "first"
                                      : r.rank === 2
                                      ? "second"
                                      : r.rank === 3
                                      ? "third"
                                      : "other"
                                  }`}
                                >
                                  {r.rank}
                                </span>
                              </div>
                            </td>
                            <td>
                              <strong>{r.studentName}</strong>
                              {isCurrent && <span className="current-user-pill">YOU</span>}
                            </td>
                            <td style={{ color: "#64748b" }}>{r.studentCity || "Pune"}</td>
                            <td>
                              <span className="score-badge">
                                {r.score}
                              </span>{" "}
                              <small style={{ color: "#94a3b8" }}>/ {r.maximumMarks}</small>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{r.percentage}%</span>
                            </td>
                            <td>
                              <span style={{ color: r.accuracy >= 80 ? "#16a34a" : "#ca8a04", fontWeight: 700 }}>
                                {r.accuracy}%
                              </span>
                            </td>
                            <td style={{ color: "#475569" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock3 size={13} color="#94a3b8" /> {r.formattedTime}
                              </span>
                            </td>
                            <td style={{ color: "#64748b" }}>
                              {new Date(r.submittedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
