import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../lib/api";
const C = createContext();
export const useAuth = () => useContext(C);

const normalizeUser = (u) => {
  if (!u) return null;
  return {
    ...u,
    role: String(u.role || "student").toLowerCase()
  };
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("meritx_token") || localStorage.getItem("meritx_token") || "",
  );
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("meritx_user") || localStorage.getItem("meritx_user");
      return normalizeUser(JSON.parse(stored));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    api("/auth/me", { token })
      .then((d) => {
        if (d?.user) {
          const u = normalizeUser(d.user);
          setUser(u);
          sessionStorage.setItem("meritx_user", JSON.stringify(u));
          if (localStorage.getItem("meritx_token")) {
            localStorage.setItem("meritx_user", JSON.stringify(u));
          }
        }
      })
      .catch((err) => {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("unauthenticated") || msg.includes("expired") || msg.includes("invalid access token")) {
          setToken("");
          setUser(null);
          sessionStorage.removeItem("meritx_token");
          sessionStorage.removeItem("meritx_user");
          localStorage.removeItem("meritx_token");
          localStorage.removeItem("meritx_user");
        } else {
          console.warn("[AuthContext] /auth/me background verification notice:", err?.message);
        }
      });
  }, [token]);

  const login = async (identifier, password, role = null, rememberMe = false) => {
    setLoading(true);
    try {
      const body = {
        email: identifier,
        username: identifier,
        password,
      };
      if (role) body.role = role;
      const data = await api("/auth/login", {
        method: "POST",
        body,
      });
      const normUser = normalizeUser(data.user);
      setToken(data.token);
      setUser(normUser);
      sessionStorage.setItem("meritx_token", data.token);
      sessionStorage.setItem("meritx_user", JSON.stringify(normUser));
      if (data.refreshToken) {
        sessionStorage.setItem("meritx_refresh_token", data.refreshToken);
      }
      if (rememberMe) {
        localStorage.setItem("meritx_token", data.token);
        localStorage.setItem("meritx_user", JSON.stringify(normUser));
        if (data.refreshToken) {
          localStorage.setItem("meritx_refresh_token", data.refreshToken);
        }
      } else {
        localStorage.removeItem("meritx_token");
        localStorage.removeItem("meritx_user");
        localStorage.removeItem("meritx_refresh_token");
      }
      return normUser;
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async ({
    name,
    email,
    password,
    target,
    role = "student",
  }) => {
    setLoading(true);
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: { name, email, password, target, role },
      });
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const sendStudentOtp = async ({ name, email, target, purpose = 'registration' }) => {
    setLoading(true);
    try {
      return await api("/auth/student/send-otp", {
        method: "POST",
        body: { name, email, target, purpose },
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyStudentOtp = async ({ email, otp, purpose = 'registration' }) => {
    setLoading(true);
    try {
      return await api("/auth/student/verify-otp", {
        method: "POST",
        body: { email, otp, purpose },
      });
    } finally {
      setLoading(false);
    }
  };

  const resendStudentOtp = async ({ email, purpose = 'registration' }) => {
    setLoading(true);
    try {
      return await api("/auth/student/resend-otp", {
        method: "POST",
        body: { email, purpose },
      });
    } finally {
      setLoading(false);
    }
  };

  const completeStudentRegistration = async (registrationData) => {
    setLoading(true);
    try {
      const data = await api("/auth/student/complete-registration", {
        method: "POST",
        body: registrationData,
      });
      if (data?.token && data?.user) {
        const normUser = normalizeUser(data.user);
        setToken(data.token);
        setUser(normUser);
        sessionStorage.setItem("meritx_token", data.token);
        sessionStorage.setItem("meritx_user", JSON.stringify(normUser));
        if (data.refreshToken) {
          sessionStorage.setItem("meritx_refresh_token", data.refreshToken);
        }
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const resetStudentPassword = async ({ email, resetToken, newPassword, confirmPassword }) => {
    setLoading(true);
    try {
      return await api("/auth/student/reset-password", {
        method: "POST",
        body: { email, resetToken, newPassword, confirmPassword },
      });
    } finally {
      setLoading(false);
    }
  };

  const switchDemoRole = async (role = "student") => {
    setLoading(true);
    try {
      const demoAccounts = {
        student: { email: "student@meritx.demo", password: "Student@123" },
        admin: { email: "admin@meritx.demo", password: "Admin@123" },
        teacher: { email: "teacher@meritx.demo", password: "Teacher@123" },
        superadmin: { email: "superadmin@meritx.demo", password: "Super@123" },
      };
      const creds = demoAccounts[role] || demoAccounts.student;
      return await login(creds.email, creds.password, role);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    const refreshToken =
      sessionStorage.getItem("meritx_refresh_token") ||
      localStorage.getItem("meritx_refresh_token");
    if (refreshToken) {
      api("/auth/logout", {
        method: "POST",
        body: { refreshToken },
      }).catch(() => {});
    }
    setToken("");
    setUser(null);
    sessionStorage.removeItem("meritx_token");
    sessionStorage.removeItem("meritx_user");
    sessionStorage.removeItem("meritx_refresh_token");
    localStorage.removeItem("meritx_token");
    localStorage.removeItem("meritx_user");
    localStorage.removeItem("meritx_refresh_token");
  };

  return (
    <C.Provider
      value={{
        user,
        token,
        loading,
        login,
        registerUser,
        sendStudentOtp,
        verifyStudentOtp,
        resendStudentOtp,
        completeStudentRegistration,
        resetStudentPassword,
        logout,
        switchDemoRole
      }}
    >
      {children}
    </C.Provider>
  );
}
