import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Users,
  Search,
  Filter,
  Download,
  ArrowUpDown,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Calendar,
  X,
  FileSpreadsheet
} from "lucide-react";
import { Shell, Stat, Loading, Empty } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, friendlyDate } from "../../lib/api";

export default function AdminLeaderboard() {
  const { token } = useAuth();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Load exams
  useEffect(() => {
    api("/exams", { token })
      .then((res) => {
        const list = res.exams || [];
        setExams(list);
        if (list.length > 0) {
          setSelectedExamId(list[0].id);
        }
      })
      .catch((err) => setError("Failed to load examinations: " + err.message));
  }, [token]);

  // Fetch leaderboard data
  const fetchLeaderboard = () => {
    if (!selectedExamId) return;
    setLoading(true);
    api(`/leaderboard/${selectedExamId}`, { token })
      .then((data) => {
        setLeaderboard(data);
        setError("");
      })
      .catch((err) => setError("Failed to load rankings: " + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedExamId]);

  // Export to CSV
  const handleExportCsv = async () => {
    try {
      const res = await api(`/leaderboard/${selectedExamId}/export`, { token });
      if (res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Leaderboard-${selectedExamId}-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert("Failed to export CSV: " + err.message);
    }
  };

  const activeExam = exams.find((e) => e.id === selectedExamId) || {
    title: "Examination",
    marks: 300
  };

  const rankings = leaderboard?.rankings || [];

  // Filter & Sort
  const filteredRankings = rankings
    .filter((item) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.studentName && item.studentName.toLowerCase().includes(q);
        const matchesEmail = item.studentEmail && item.studentEmail.toLowerCase().includes(q);
        const matchesCity = item.studentCity && item.studentCity.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesCity) return false;
      }
      // Score filter
      if (scoreFilter === "top") {
        if (item.percentage < 80) return false;
      } else if (scoreFilter === "mid") {
        if (item.percentage < 60 || item.percentage >= 80) return false;
      } else if (scoreFilter === "low") {
        if (item.percentage >= 60) return false;
      }
      // Status filter
      if (statusFilter !== "all") {
        if (item.status !== statusFilter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <Shell
      title="Examination Leaderboards"
      kicker="ADMIN MERIT RANKING ENGINE"
      description="Inspect deterministic merit rankings, participant attempts, score distributions, and export official CSV reports."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary small" onClick={handleExportCsv} disabled={!rankings.length}>
            <Download size={15} /> Export CSV Report
          </button>
          <Link to="/admin/exams" className="btn btn-outline small">
            Manage Exams →
          </Link>
        </div>
      }
    >
      {/* Controls Bar */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
              <Trophy size={16} color="#2563eb" /> Select Exam:
            </label>
            <select
              style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #cbd5e1", minWidth: 280, fontWeight: 600 }}
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.subject || "General"})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              Total Candidates Ranked: <strong>{rankings.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <Loading />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid-4" style={{ marginBottom: 22 }}>
            <Stat
              icon={Users}
              label="Total Candidates"
              value={leaderboard?.totalParticipants || 0}
              tone="purple"
              delta="Attempt submissions"
            />
            <Stat
              icon={Trophy}
              label="Highest Score"
              value={`${leaderboard?.highestScore || 0}/${activeExam.marks || 300}`}
              tone="green"
              delta="Rank 1 score"
            />
            <Stat
              icon={Trophy}
              label="Average Score"
              value={`${leaderboard?.averageScore || 0}/${activeExam.marks || 300}`}
              tone="cyan"
              delta="Cohort mean"
            />
            <Stat
              icon={Trophy}
              label="Lowest Score"
              value={`${leaderboard?.lowestScore || 0}/${activeExam.marks || 300}`}
              tone="default"
              delta="Minimum achieved"
            />
          </div>

          {/* Table Panel with Filter Bar */}
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {/* Search */}
                <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 12px", width: 260 }}>
                  <Search size={15} color="#94a3b8" style={{ marginRight: 8 }} />
                  <input
                    type="text"
                    placeholder="Search candidate or city..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, width: "100%" }}
                  />
                </div>

                {/* Score Filter */}
                <select
                  value={scoreFilter}
                  onChange={(e) => setScoreFilter(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
                >
                  <option value="all">All Scores</option>
                  <option value="top">Top Tier (&gt;= 80%)</option>
                  <option value="mid">Mid Tier (60% - 79%)</option>
                  <option value="low">Low Tier (&lt; 60%)</option>
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
              </div>

              <span style={{ fontSize: 12, color: "#64748b" }}>
                Showing <strong>{filteredRankings.length}</strong> of {rankings.length} participants
              </span>
            </div>

            {filteredRankings.length === 0 ? (
              <Empty title="No Candidates Found" text="No candidates matched the current filter or search criteria." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", fontSize: 12, color: "#475569" }}>
                      <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => toggleSort("rank")}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          Rank <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => toggleSort("studentName")}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          Candidate <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: "12px 16px" }}>Location</th>
                      <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => toggleSort("score")}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          Score <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => toggleSort("percentage")}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          % <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => toggleSort("accuracy")}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          Accuracy <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => toggleSort("timeTaken")}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          Time Taken <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((item) => (
                      <tr key={item.id || item.studentId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 800 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              textAlign: "center",
                              lineHeight: "24px",
                              fontSize: 12,
                              background: item.rank === 1 ? "#fef3c7" : item.rank === 2 ? "#f1f5f9" : item.rank === 3 ? "#ffedd5" : "transparent",
                              color: item.rank === 1 ? "#b45309" : item.rank === 2 ? "#475569" : item.rank === 3 ? "#c2410c" : "#64748b",
                              fontWeight: 800
                            }}
                          >
                            {item.rank}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ color: "#0f172a" }}>{item.studentName}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{item.studentEmail}</div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{item.studentCity || "Pune"}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ color: "#2563eb", fontSize: 14 }}>{item.score}</strong>
                          <small style={{ color: "#94a3b8" }}> / {item.maximumMarks}</small>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>{item.percentage}%</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ color: item.accuracy >= 80 ? "#16a34a" : "#d97706", fontWeight: 700 }}>
                            {item.accuracy}%
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#475569" }}>{item.formattedTime}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            className={`tag ${
                              item.status === "submitted" ? "green" : item.status === "TERMINATED" ? "danger" : ""
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            className="btn btn-soft small"
                            onClick={() => setSelectedStudent(item)}
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
        </>
      )}

      {/* Inspect Student Modal */}
      {selectedStudent && (
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
          onClick={() => setSelectedStudent(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 500,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Attempt Details</h3>
                <small style={{ color: "#64748b" }}>Rank #{selectedStudent.rank} · {selectedStudent.studentName}</small>
              </div>
              <button
                type="button"
                className="btn btn-outline small"
                onClick={() => setSelectedStudent(null)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <small style={{ color: "#64748b" }}>Total Score</small>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#2563eb" }}>
                  {selectedStudent.score} / {selectedStudent.maximumMarks}
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <small style={{ color: "#64748b" }}>Accuracy</small>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>
                  {selectedStudent.accuracy}%
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <small style={{ color: "#64748b" }}>Time Taken</small>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedStudent.formattedTime}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <small style={{ color: "#64748b" }}>Questions Attempted</small>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedStudent.attempted}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 20 }}>
              <div><strong>Email:</strong> {selectedStudent.studentEmail}</div>
              <div><strong>City:</strong> {selectedStudent.studentCity || "Pune"}</div>
              <div><strong>Status:</strong> {selectedStudent.status}</div>
              <div><strong>Submitted At:</strong> {new Date(selectedStudent.submittedAt).toLocaleString("en-IN")}</div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() => setSelectedStudent(null)}
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
