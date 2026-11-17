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
    () => sessionStorage.getItem("meritx_token") || "",
  );
  const [user, setUser] = useState(() => {
    try {
      return normalizeUser(JSON.parse(sessionStorage.getItem("meritx_user")));
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
        }
      })
      .catch((err) => {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("unauthenticated") || msg.includes("expired") || msg.includes("invalid access token")) {
          setToken("");
          setUser(null);
          sessionStorage.removeItem("meritx_token");
          sessionStorage.removeItem("meritx_user");
        } else {
          console.warn("[AuthContext] /auth/me background verification notice:", err?.message);
        }
      });
  }, [token]);
  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const normUser = normalizeUser(data.user);
      setToken(data.token);
      setUser(normUser);
      sessionStorage.setItem("meritx_token", data.token);
      sessionStorage.setItem("meritx_user", JSON.stringify(normUser));
      return normUser;
    } finally {
      setLoading(false);
    }
  };
  const googleLogin = useCallback(async (credential, target) => {
    setLoading(true);
    try {
      const data = await api("/auth/google", {
        method: "POST",
        body: { credential, target },
      });
      const normUser = normalizeUser(data.user);
      setToken(data.token);
      setUser(normUser);
      sessionStorage.setItem("meritx_token", data.token);
      sessionStorage.setItem("meritx_user", JSON.stringify(normUser));
      return normUser;
    } finally {
      setLoading(false);
    }
  }, []);
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
      return await login(creds.email, creds.password);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken("");
    setUser(null);
    sessionStorage.removeItem("meritx_token");
    sessionStorage.removeItem("meritx_user");
  };
  return (
    <C.Provider
      value={{ user, token, loading, login, googleLogin, registerUser, logout, switchDemoRole }}
    >
      {children}
    </C.Provider>
  );
}
