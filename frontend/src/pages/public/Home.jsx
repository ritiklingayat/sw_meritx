import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  FlaskConical,
  GraduationCap,
  LineChart,
  Lock,
  ShieldCheck,
  Target,
  Trophy,
  User,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { evaluatePasswordCriteria, isValidEmail, maskEmailAddress } from "../../lib/passwordValidation";
import { ExamCard } from "./Exams";
import sliderUpsc from "../../assets/Images/Sliders/8-display.jpg";
import sliderNeet from "../../assets/Images/Sliders/9-display.jpg";
import "./Home.css";

const slides = [
  {
    image: sliderUpsc,
    alt: "UPSC CSE Parivartan Mentorship Programme for integrated prelims and mains preparation",
    href: "/exams",
  },
  {
    image: sliderNeet,
    alt: "NEET Biology Sprint for biology revision, NCERT concepts, and high-yield topics",
    href: "/exams/neet-biology-01",
  },
];

const features = [
  {
    icon: Target,
    title: "Exam-real practice",
    text: "Timed mock exams help you rehearse decisions, pacing, and focus.",
  },
  {
    icon: LineChart,
    title: "Clear performance review",
    text: "See accuracy, score, and answer explanations after each attempt.",
  },
  {
    icon: BrainCircuit,
    title: "Focused question bank",
    text: "Practice the existing JEE and NEET sample questions by subject.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent demo",
    text: "Securely stored practice data, with no real payments or false promises.",
  },
];

export default function Home() {
  const { user, token, login, logout, sendStudentOtp } = useAuth();
  const nav = useNavigate();
  const [active, setActive] = useState(0);
  const [exams, setExams] = useState([]);
  const [landing, setLanding] = useState(null);
  const touchStart = useRef(null);
  const change = (next) => setActive((next + slides.length) % slides.length);

  // Student Authentication on Home Page state
  const [authTab, setAuthTab] = useState("login"); // 'login' or 'register'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authTarget, setAuthTarget] = useState("JEE Main");
  const [authAgreeTerms, setAuthAgreeTerms] = useState(false);
  const [authShowPass, setAuthShowPass] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return undefined;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api("/exams", { token })
      .then((examData) => setExams(examData?.exams || []))
      .catch(() => {});
    api("/landing-content")
      .then((contentData) =>
        setLanding(contentData?.content?.about_courses || null),
      )
      .catch(() => {});
  }, [token]);

  const handleHomeStudentLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");
    const cleanEmail = authEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setAuthError("Please enter a valid student email address.");
      return;
    }
    if (!authPassword) {
      setAuthError("Please enter your password.");
      return;
    }
    setAuthBusy(true);
    try {
      const u = await login(cleanEmail, authPassword, "student");
      if (u?.role !== "student") {
        logout();
        setAuthError(
          "Access denied: This login is strictly for students. Teachers and Administrators must use their dedicated login portals.",
        );
        return;
      }
      nav("/student");
    } catch (err) {
      setAuthError(err.message || "Invalid student credentials.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleHomeStudentRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");

    const cleanName = authName.trim();
    const cleanEmail = authEmail.trim().toLowerCase();
    const { isPasswordValid } = evaluatePasswordCriteria(authPassword, authConfirmPassword);

    if (cleanName.length < 2) {
      setAuthError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setAuthError("Please enter a valid student email address.");
      return;
    }
    if (!isPasswordValid) {
      setAuthError("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError("Password and Confirm Password do not match.");
      return;
    }
    if (!authAgreeTerms) {
      setAuthError("Please agree to the Terms & Conditions to continue.");
      return;
    }

    setAuthBusy(true);
    try {
      const res = await sendStudentOtp({
        name: cleanName,
        email: cleanEmail,
        target: authTarget,
        purpose: "registration",
      });
      nav("/verify-email", {
        state: {
          name: cleanName,
          email: cleanEmail,
          target: authTarget,
          password: authPassword,
          confirmPassword: authConfirmPassword,
          purpose: "registration",
          maskedEmail: res?.maskedEmail || maskEmailAddress(cleanEmail),
          cooldownSeconds: res?.cooldownSeconds || 60,
          initialNotice: "A 6-digit verification code has been sent to your email.",
        },
      });
    } catch (err) {
      setAuthError(err.message || "Failed to send verification code.");
    } finally {
      setAuthBusy(false);
    }
  };

  const slide = slides[active];
  return (
    <>
      <SiteHeader />
      <main className="home">
        <section
          className="banner-carousel"
          aria-roledescription="carousel"
          aria-label="Meritx subject highlights"
          aria-live="polite"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") change(active - 1);
            if (event.key === "ArrowRight") change(active + 1);
          }}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            const distance =
              event.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(distance) > 45)
              change(active + (distance < 0 ? 1 : -1));
          }}
          tabIndex="0"
        >
          <div className="banner-stage">
            <Link
              className="banner-link"
              to={slide.href}
              aria-label={`${slide.alt}. Open exam details.`}
              key={slide.image}
            >
              <img src={slide.image} alt={slide.alt} />
            </Link>
            <button
              className="banner-arrow banner-prev"
              type="button"
              onClick={() => change(active - 1)}
              aria-label="Previous slide"
            >
              <ArrowLeft />
            </button>
            <button
              className="banner-arrow banner-next"
              type="button"
              onClick={() => change(active + 1)}
              aria-label="Next slide"
            >
              <ArrowRight />
            </button>
            <div className="banner-dots" aria-label="Choose a slide">
              {slides.map((item, index) => (
                <button
                  type="button"
                  key={item.image}
                  className={index === active ? "active" : ""}
                  onClick={() => setActive(index)}
                  aria-label={`Show slide ${index + 1}`}
                  aria-current={index === active ? "true" : undefined}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          className="category-strip"
          id="subjects"
          aria-label="Available subjects"
        >
          <div className="container category-grid">
            {[
              [GraduationCap, "Physics"],
              [FlaskConical, "Chemistry"],
              [Trophy, "Mathematics"],
              [BookOpen, "Biology"],
            ].map(([Icon, label]) => (
              <Link to="/exams" key={label}>
                <span>
                  <Icon />
                </span>
                <div>
                  <small>EXPLORE</small>
                  <strong>{label}</strong>
                </div>
                <ArrowUpRight className="category-arrow" />
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section courses-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">SUBJECT-BASED PRACTICE</span>
                <h2>Choose your next challenge</h2>
                <p>
                  Practice Physics, Chemistry, Mathematics, and Biology in the
                  available Meritx exams.
                </p>
              </div>
              <Link className="section-link" to="/exams">
                Explore all exams <ArrowRight size={16} />
              </Link>
            </div>
            <div className="home-course-grid">
              {exams
                .slice(0, 4)
                .map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
            </div>
          </div>
        </section>

        {landing?.visible !== false && (
          <section className="home-section about-courses">
            <div className="container">
              <div className="panel">
                <span className="section-kicker">MERITX EXAMINATIONS</span>
                <h2>{landing?.heading || "About Our Examinations"}</h2>
                <p>
                  {landing?.description ||
                    "Structured mock examinations for your target entrance test."}
                </p>
                <Link className="btn btn-primary" to="/exams">
                  {landing?.buttonLabel || "Explore examinations"}{" "}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="home-section benefits-section" id="about">
          <div className="container">
            <div className="section-heading centered">
              <div>
                <span className="section-kicker">WHY MERITX</span>
                <h2>Everything important, nothing distracting.</h2>
                <p>
                  A straightforward learning experience shaped around practice
                  and reflection.
                </p>
              </div>
            </div>
            <div className="benefit-grid">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span>
                    <Icon />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Student Portal Quick Authentication Section (Student Only) */}
        <section className="home-auth-section" id="student-portal">
          <div className="container">
            <div className="section-heading centered" style={{ marginBottom: "28px" }}>
              <div>
                <span className="section-kicker">STUDENT WORKSPACE ACCESS</span>
                <h2>Start Your Preparation Journey</h2>
                <p>
                  Access authentic timed mock tests, question-wise analytics, and performance reports.
                </p>
              </div>
            </div>

            <div className="home-auth-card">
              {user ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      background: "#e0e7ff",
                      color: "#3730a3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                      fontSize: "22px",
                      fontWeight: 800,
                    }}
                  >
                    {user?.name?.charAt(0) || "S"}
                  </div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "20px", color: "#1e293b" }}>
                    Signed in as {user?.name}
                  </h3>
                  <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b" }}>
                    Role: <strong style={{ textTransform: "capitalize" }}>{user?.role}</strong> · {user?.email}
                  </p>
                  <Link
                    to={user.role === "student" ? "/student" : "/" + user.role}
                    className="btn btn-primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                  >
                    Open Dashboard <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="home-auth-tabs">
                    <button
                      type="button"
                      className={`home-auth-tab ${authTab === "login" ? "active" : ""}`}
                      onClick={() => {
                        setAuthTab("login");
                        setAuthError("");
                        setAuthNotice("");
                      }}
                    >
                      <User size={15} /> Student Login
                    </button>
                    <button
                      type="button"
                      className={`home-auth-tab ${authTab === "register" ? "active" : ""}`}
                      onClick={() => {
                        setAuthTab("register");
                        setAuthError("");
                        setAuthNotice("");
                      }}
                    >
                      <GraduationCap size={15} /> Create Student Account
                    </button>
                  </div>

                  {authNotice && <div className="alert success">{authNotice}</div>}
                  {authError && <div className="alert error">{authError}</div>}

                  {authTab === "login" ? (
                    <form onSubmit={handleHomeStudentLogin}>
                      <div className="field">
                        <label>Student Email Address</label>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="student@example.com"
                          required
                        />
                      </div>

                      <div className="field">
                        <label>Password</label>
                        <div className="password-wrap">
                          <input
                            type={authShowPass ? "text" : "password"}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setAuthShowPass(!authShowPass)}
                            aria-label={authShowPass ? "Hide password" : "Show password"}
                          >
                            {authShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px", marginTop: "-6px" }}>
                        <Link to="/forgot-password" style={{ fontSize: "12.5px", fontWeight: 600, color: "#2563eb" }}>
                          Forgot Password?
                        </Link>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary home-auth-submit"
                        disabled={authBusy}
                      >
                        {authBusy ? "Signing in..." : "Sign In as Student"}{" "}
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleHomeStudentRegister} noValidate>
                      <div className="field">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="Your full name"
                          required
                        />
                      </div>

                      <div className="field">
                        <label>Student Email Address</label>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="student@example.com"
                          required
                        />
                      </div>

                      <div className="field">
                        <label>Create Password</label>
                        <div className="password-wrap">
                          <input
                            type={authShowPass ? "text" : "password"}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="8+ chars, upper, lower, number, symbol"
                            minLength={8}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setAuthShowPass(!authShowPass)}
                            aria-label={authShowPass ? "Hide password" : "Show password"}
                          >
                            {authShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="field">
                        <label>Confirm Password</label>
                        <input
                          type={authShowPass ? "text" : "password"}
                          value={authConfirmPassword}
                          onChange={(e) => setAuthConfirmPassword(e.target.value)}
                          placeholder="Re-enter your password"
                          required
                        />
                      </div>

                      <div className="field">
                        <label>Target Examination</label>
                        <select
                          value={authTarget}
                          onChange={(e) => setAuthTarget(e.target.value)}
                        >
                          <option>JEE Main</option>
                          <option>JEE Advanced</option>
                          <option>NEET UG</option>
                          <option>MHT-CET</option>
                        </select>
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#475569", marginBottom: "14px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={authAgreeTerms}
                          onChange={(e) => setAuthAgreeTerms(e.target.checked)}
                          style={{ accentColor: "#2563eb" }}
                        />
                        <span>I agree to the Terms &amp; Conditions and Privacy Policy</span>
                      </label>

                      <button
                        type="submit"
                        className="btn btn-primary home-auth-submit"
                        disabled={authBusy}
                      >
                        {authBusy ? "Sending OTP via Brevo..." : "Send OTP & Continue"}{" "}
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="learning-band">
          <div className="container learning-band-grid">
            <div>
              <span className="section-kicker light">LEARN ANYWHERE</span>
              <h2>Your preparation space, always within reach.</h2>
              <p>
                Browse subjects, register as a student, attempt realistic sample
                exams, and review your progress across sessions.
              </p>
              <div className="band-checks">
                <span>
                  <CheckCircle2 /> Responsive on every screen
                </span>
                <span>
                  <CheckCircle2 /> Progress stored securely
                </span>
              </div>
              <Link className="btn btn-light" to="/register">
                Create Student Account <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="device-art" aria-hidden="true">
              <div className="device-laptop">
                <div>
                  <span />
                  <span />
                  <span />
                </div>
                <main>
                  <aside />
                  <section>
                    <small>MERITX</small>
                    <strong>Learn. Practice. Rise.</strong>
                    <i />
                    <i />
                  </section>
                </main>
              </div>
              <div className="device-phone">
                <span />
                <main>
                  <b>84%</b>
                  <small>Accuracy</small>
                  <i />
                  <i />
                  <i />
                </main>
              </div>
            </div>
          </div>
        </section>

        <section className="home-section faq-section" id="contact">
          <div className="container faq-grid">
            <div>
              <span className="section-kicker">GOOD TO KNOW</span>
              <h2>Built as a transparent learning demo.</h2>
              <p>
                Student profiles and practice progress are stored in the configured
                MERITX database. Payments, live ranking, and payouts are illustrative.
              </p>
              <Link className="section-link" to="/login">
                Student Login <ArrowRight size={16} />
              </Link>
            </div>
            <div className="faq-list">
              {[
                "How is my progress saved?",
                "Are payments or prizes active?",
                "Can I try the exam flow?",
              ].map((question, index) => (
                <details key={question} open={index === 0}>
                  <summary>
                    {question}
                    <ChevronDown />
                  </summary>
                  <p>
                    {index === 0
                      ? "Your student account, registrations, attempts, and support requests are stored by the secure MERITX API."
                      : index === 1
                        ? "No. Any fee or prize information belongs to the original demo data and is clearly presented as illustrative."
                        : "Yes. Use the student demo account, register for an exam, and complete the sample test."}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
