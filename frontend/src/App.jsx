import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import WhatsAppButton from "./components/WhatsAppButton";
import Home from "./pages/public/Home";
import Exams from "./pages/public/Exams";
import ExamDetails from "./pages/public/ExamDetails";
import Auth from "./pages/auth/Auth";
import StudentLogin from "./pages/auth/StudentLogin";
import StudentRegister from "./pages/auth/StudentRegister";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import TeacherLogin from "./pages/auth/TeacherLogin";
import AdminLogin from "./pages/auth/AdminLogin";
import Exam from "./pages/exam/Exam";
import DashboardExplore from "./pages/common/Explore";
import StudentLeaderboard from "./pages/student/StudentLeaderboard";
import AdminLeaderboard from "./pages/admin/AdminLeaderboard";
import AdminResults from "./pages/admin/AdminResults";
import {
  StudentDashboard,
  MyExams,
  MyCourses,
  BrowseExams,
  BrowseCourses,
  MyWallet,
  AddMoney,
  WithdrawMoney,
  DepositHistory,
  TransactionHistory,
  StudentProfile,
  Results,
  Rewards,
  Support,
} from "./pages/student/Student";
import {
  TeacherDashboard,
  TeacherCourses,
  TeacherProfile,
  PaperBuilder,
  QuestionBank,
  ImportQuestionBank,
} from "./pages/teacher/Teacher";
import {
  AdminDashboard,
  ManageExams,
  ManageStudents,
  ManageQuestions,
  ManagePapers,
  ManageQuestionBanks,
  ManageSupport,
  ManageCourses,
  PlatformConfiguration,
  PrizeManagement,
  ExamRegistrations,
  AdminWalletTransactions,
} from "./pages/admin/Admin";
import {
  FinanceDashboard,
  StudentWalletManagement,
  WithdrawalManagement,
  FinancialReports,
  Transactions,
  Audit,
} from "./pages/superadmin/Finance";
import LiveProctoringDashboard from "./pages/admin/LiveProctoring";

function Protected({ role, children }) {
  const { user } = useAuth(),
    location = useLocation();
  if (!user) {
    if (role === "teacher" || location.pathname.startsWith("/teacher")) {
      return <Navigate to="/teacher" state={{ from: location.pathname }} replace />;
    }
    if (
      role === "admin" ||
      role === "superadmin" ||
      location.pathname.startsWith("/admin") ||
      location.pathname.startsWith("/superadmin")
    ) {
      return <Navigate to="/admin" state={{ from: location.pathname }} replace />;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  const userRole = String(user.role || "").toLowerCase();
  const targetRole = String(role || "").toLowerCase();
  if (userRole !== targetRole && !(targetRole === "admin" && userRole === "superadmin"))
    return <Navigate to={"/" + userRole} replace />;
  return children;
}

function TeacherRoute() {
  const { user } = useAuth();
  if (!user) {
    return <TeacherLogin />;
  }
  const userRole = String(user.role || "").toLowerCase();
  if (userRole === "teacher") {
    return <TeacherDashboard />;
  }
  return <Navigate to={"/" + userRole} replace />;
}

function AdminRoute() {
  const { user } = useAuth();
  if (!user) {
    return <AdminLogin />;
  }
  const userRole = String(user.role || "").toLowerCase();
  if (userRole === "admin" || userRole === "superadmin") {
    return <AdminDashboard />;
  }
  return <Navigate to={"/" + userRole} replace />;
}

const protect = (role, Component) => (
  <Protected role={role}>
    <Component />
  </Protected>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public & Student Auth Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/:id" element={<ExamDetails />} />
          <Route path="/login" element={<StudentLogin />} />
          <Route path="/register" element={<StudentRegister />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Student Routes */}
          <Route
            path="/student"
            element={protect("student", StudentDashboard)}
          />
          <Route
            path="/student/exams"
            element={protect("student", MyExams)}
          />
          <Route
            path="/student/courses"
            element={protect("student", MyExams)}
          />
          <Route
            path="/student/browse"
            element={protect("student", BrowseExams)}
          />
          <Route
            path="/student/available"
            element={protect("student", BrowseExams)}
          />
          <Route
            path="/student/history"
            element={protect("student", Results)}
          />
          <Route
            path="/student/leaderboard"
            element={protect("student", StudentLeaderboard)}
          />
          <Route
            path="/student/wallet"
            element={protect("student", MyWallet)}
          />
          <Route
            path="/student/deposit"
            element={protect("student", AddMoney)}
          />
          <Route
            path="/student/withdraw"
            element={protect("student", WithdrawMoney)}
          />
          <Route
            path="/student/deposits"
            element={protect("student", DepositHistory)}
          />
          <Route
            path="/student/transactions"
            element={protect("student", TransactionHistory)}
          />
          <Route
            path="/student/profile"
            element={protect("student", StudentProfile)}
          />
          <Route
            path="/student/explore"
            element={protect("student", DashboardExplore)}
          />
          <Route
            path="/student/results"
            element={protect("student", Results)}
          />
          <Route
            path="/student/rewards"
            element={protect("student", MyWallet)}
          />
          <Route
            path="/student/support"
            element={protect("student", Support)}
          />
          <Route path="/take/:id" element={protect("student", Exam)} />

          {/* Teacher Routes */}
          <Route path="/teacher" element={<TeacherRoute />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route
            path="/teacher/dashboard"
            element={protect("teacher", TeacherDashboard)}
          />
          <Route
            path="/teacher/courses"
            element={protect("teacher", TeacherCourses)}
          />
          <Route
            path="/teacher/profile"
            element={protect("teacher", TeacherProfile)}
          />
          <Route
            path="/teacher/explore"
            element={protect("teacher", DashboardExplore)}
          />
          <Route
            path="/teacher/papers"
            element={protect("teacher", PaperBuilder)}
          />
          <Route
            path="/teacher/questions"
            element={protect("teacher", QuestionBank)}
          />
          <Route
            path="/teacher/import"
            element={protect("teacher", ImportQuestionBank)}
          />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={protect("admin", AdminDashboard)} />
          <Route
            path="/admin/finance"
            element={protect("admin", FinanceDashboard)}
          />
          <Route
            path="/admin/proctoring"
            element={protect("admin", LiveProctoringDashboard)}
          />
          <Route
            path="/admin/wallets"
            element={protect("admin", StudentWalletManagement)}
          />
          <Route
            path="/admin/withdrawals"
            element={protect("admin", WithdrawalManagement)}
          />
          <Route
            path="/admin/reports"
            element={protect("admin", FinancialReports)}
          />
          <Route
            path="/admin/explore"
            element={protect("admin", DashboardExplore)}
          />
          <Route path="/admin/exams" element={protect("admin", ManageExams)} />
          <Route path="/admin/registrations" element={protect("admin", ExamRegistrations)} />
          <Route path="/admin/transactions" element={protect("admin", AdminWalletTransactions)} />
          <Route path="/admin/questions" element={protect("admin", ManageQuestions)} />
          <Route path="/admin/results" element={protect("admin", AdminResults)} />
          <Route path="/admin/leaderboards" element={protect("admin", AdminLeaderboard)} />
          <Route path="/admin/settings" element={protect("admin", PlatformConfiguration)} />
          <Route
            path="/admin/prizes"
            element={protect("admin", PrizeManagement)}
          />
          <Route
            path="/admin/students"
            element={protect("admin", ManageStudents)}
          />
          <Route
            path="/admin/papers"
            element={protect("admin", ManagePapers)}
          />
          <Route
            path="/admin/question-banks"
            element={protect("admin", ManageQuestionBanks)}
          />
          <Route
            path="/admin/import"
            element={protect("admin", ImportQuestionBank)}
          />
          <Route
            path="/admin/support"
            element={protect("admin", ManageSupport)}
          />
          <Route
            path="/admin/courses"
            element={protect("admin", ManageCourses)}
          />
          <Route
            path="/admin/configuration"
            element={protect("admin", PlatformConfiguration)}
          />

          {/* Superadmin Routes */}
          <Route
            path="/superadmin"
            element={protect("superadmin", FinanceDashboard)}
          />
          <Route
            path="/superadmin/finance"
            element={protect("superadmin", FinanceDashboard)}
          />
          <Route
            path="/superadmin/proctoring"
            element={protect("superadmin", LiveProctoringDashboard)}
          />
          <Route
            path="/superadmin/wallets"
            element={protect("superadmin", StudentWalletManagement)}
          />
          <Route
            path="/superadmin/withdrawals"
            element={protect("superadmin", WithdrawalManagement)}
          />
          <Route
            path="/superadmin/reports"
            element={protect("superadmin", FinancialReports)}
          />
          <Route
            path="/superadmin/explore"
            element={protect("superadmin", DashboardExplore)}
          />
          <Route
            path="/superadmin/payments"
            element={protect("superadmin", Transactions)}
          />
          <Route
            path="/superadmin/audit"
            element={protect("superadmin", Audit)}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <WhatsAppButton />
      </AuthProvider>
    </BrowserRouter>
  );
}
