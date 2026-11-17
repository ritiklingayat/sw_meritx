import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Calendar,
  Eye,
  Trophy,
  Users,
  X,
  ArrowUpRight
} from "lucide-react";
import { Shell, Stat, Loading, Empty } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, friendlyDate } from "../../lib/api";

export default function AdminResults() {
  const { token } = useAuth();
  const [results, setResults] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flagFilter, setFlagFilter] = useState("all");
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api("/admin/results", { token }),
      api("/exams", { token })
    ])
      .then(([resData, examData]) => {
        setResults(resData.results || []);
        setExams(examData.exams || []);
        setError("");
      })
      .catch((err) => setError("Failed to load results: " + err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const filteredResults = results.filter((r) => {
    if (examFilter !== "all" && r.examId !== examFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (flagFilter === "flagged" && !r.isFlagged) return false;
    if (flagFilter === "clean" && r.isFlagged) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.studentName && r.studentName.toLowerCase().includes(q);
      const matchEmail = r.studentEmail && r.studentEmail.toLowerCase().includes(q);
      const matchExam = r.examTitle && r.examTitle.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchExam) return false;
    }
    return true;
  });

  const totalEvaluated = results.length;
  const totalSubmitted = results.filter((r) => r.status === "submitted").length;
  const totalTerminated = results.filter((r) => r.status === "TERMINATED").length;
  const totalFlagged = results.filter((r) => r.isFlagged || r.warningCount > 0).length;

  return (
    <Shell
      title="Examination Submissions & Results"
      kicker="ASSESSMENT EVALUATION HUB"
      description="Review candidate exam submissions, automatic score calculations, proctoring violations, and performance analytics."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/admin/leaderboards" className="btn btn-primary small">
            <Trophy size={15} /> View Leaderboards
          </Link>
          <Link to="/admin/proctoring" className="btn btn-outline small">
            Live Proctoring →
          </Link>
        </div>
      }
    >
      {/* 4 Stats */}
      <div className="grid-4" style={{ marginBottom: 22 }}>
        <Stat
          icon={BarChart3}
          label="Total Evaluated"
          value={totalEvaluated}
          tone="purple"
          delta="Completed attempts"
        />
        <Stat
          icon={CheckCircle2}
          label="Normal Submissions"
          value={totalSubmitted}
          tone="green"
          delta="Clean completions"
        />
        <Stat
          icon={AlertTriangle}
          label="Flagged Attempts"
          value={totalFlagged}
          tone="cyan"
          delta="Proctoring warnings"
        />
        <Stat
          icon={AlertTriangle}
          label="Terminated Attempts"
          value={totalTerminated}
          tone="danger"
          delta="Violations exceeded"
        />
      </div>

      {error && <div className="alert error">{error}</div>}

      {/* Main Table Panel */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {/* Filters Header */}
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 12px", width: 240 }}>
              <Search size={15} color="#94a3b8" style={{ marginRight: 8 }} />
              <input
                type="text"
                placeholder="Search student or exam..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, width: "100%" }}
              />
            </div>

            {/* Exam Filter */}
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
            >
              <option value="all">All Examinations</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="TERMINATED">Terminated</option>
            </select>

            {/* Flag Filter */}
            <select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
            >
              <option value="all">All Monitoring</option>
              <option value="clean">Clean (0 Warnings)</option>
              <option value="flagged">Flagged / Warnings</option>
            </select>
          </div>

          <span style={{ fontSize: 12, color: "#64748b" }}>
            Showing <strong>{filteredResults.length}</strong> records
          </span>
        </div>

        {loading ? (
          <Loading />
        ) : filteredResults.length === 0 ? (
          <Empty title="No Exam Submissions Found" text="No submitted examination records match your filter criteria." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", fontSize: 12, color: "#475569" }}>
                  <th style={{ padding: "12px 16px" }}>Candidate</th>
                  <th style={{ padding: "12px 16px" }}>Examination</th>
                  <th style={{ padding: "12px 16px" }}>Score</th>
                  <th style={{ padding: "12px 16px" }}>Accuracy</th>
                  <th style={{ padding: "12px 16px" }}>Time Taken</th>
                  <th style={{ padding: "12px 16px" }}>Violations</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Submitted Date</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <strong style={{ color: "#0f172a" }}>{item.studentName}</strong>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{item.studentEmail}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <strong>{item.examTitle}</strong>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <strong style={{ color: "#2563eb", fontSize: 14 }}>{item.score}</strong>
                      <small style={{ color: "#94a3b8" }}> / {item.maximumMarks}</small>
                      <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>{item.percentage}%</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ color: item.accuracy >= 80 ? "#16a34a" : "#d97706", fontWeight: 700 }}>
                        {item.accuracy}%
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>
                      {Math.floor(item.timeTaken / 60)}m {item.timeTaken % 60}s
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {item.warningCount > 0 ? (
                        <span className="tag danger" style={{ fontSize: 11 }}>
                          {item.warningCount} Warnings
                        </span>
                      ) : (
                        <span className="tag green" style={{ fontSize: 11 }}>
                          0 Warnings
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`tag ${item.status === "submitted" ? "green" : "danger"}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>
                      {new Date(item.submittedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        className="btn btn-soft small"
                        onClick={() => setSelectedResult(item)}
                      >
                        <Eye size={13} style={{ marginRight: 4 }} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {selectedResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 20
          }}
          onClick={() => setSelectedResult(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Candidate Assessment Summary</h3>
                <small style={{ color: "#64748b" }}>{selectedResult.studentName} · {selectedResult.examTitle}</small>
              </div>
              <button
                type="button"
                className="btn btn-outline small"
                onClick={() => setSelectedResult(null)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <small style={{ color: "#64748b" }}>Calculated Marks</small>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#2563eb" }}>
                  {selectedResult.score} / {selectedResult.maximumMarks}
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <small style={{ color: "#64748b" }}>Overall Accuracy</small>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>
                  {selectedResult.accuracy}%
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#f0fdf4", padding: 10, borderRadius: 8, textAlign: "center" }}>
                <small style={{ color: "#166534" }}>Correct</small>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{selectedResult.correct}</div>
              </div>
              <div style={{ background: "#fef2f2", padding: 10, borderRadius: 8, textAlign: "center" }}>
                <small style={{ color: "#991b1b" }}>Incorrect</small>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>{selectedResult.incorrect}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, textAlign: "center" }}>
                <small style={{ color: "#64748b" }}>Attempted</small>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{selectedResult.attempted}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
              <div><strong>Candidate Email:</strong> {selectedResult.studentEmail}</div>
              <div><strong>Examination Status:</strong> {selectedResult.status}</div>
              <div><strong>Proctoring Violations:</strong> {selectedResult.warningCount} warnings</div>
              <div><strong>Time Taken:</strong> {Math.floor(selectedResult.timeTaken / 60)} minutes {selectedResult.timeTaken % 60} seconds</div>
              <div><strong>Submission Timestamp:</strong> {new Date(selectedResult.submittedAt).toLocaleString("en-IN")}</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Link
                to={`/admin/leaderboards?examId=${selectedResult.examId}`}
                className="btn btn-outline"
                style={{ flex: 1, textAlign: "center" }}
              >
                View in Leaderboard
              </Link>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setSelectedResult(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
