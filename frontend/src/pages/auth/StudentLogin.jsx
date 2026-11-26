import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { isValidEmail } from '../../lib/passwordValidation';
import './Auth.css';

export default function StudentLogin() {
  const { user, login, logout, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    location.state?.registered
      ? 'Registration successful! Please sign in with your student credentials.'
      : location.state?.resetSuccess
      ? 'Password reset successful! Please sign in with your new password.'
      : ''
  );

  useEffect(() => {
    if (user) {
      const role = String(user.role || '').toLowerCase();
      if (role === 'student') {
        nav('/student', { replace: true });
      }
    }
  }, [user, nav]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid student email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setBusy(true);

    try {
      // Enforce STUDENT role strictly
      const authenticated = await login(cleanEmail, password, 'student', rememberMe);
      const role = String(authenticated?.role || '').toLowerCase();

      if (role !== 'student') {
        logout();
        setError('Access denied: Only students can log in through this portal. Teachers and Administrators must use their dedicated login portals.');
        return;
      }

      const fromPath = location.state?.from;
      const safeRedirect =
        typeof fromPath === 'string' && (fromPath.startsWith('/student') || fromPath.startsWith('/take/'))
          ? fromPath
          : '/student';
      nav(safeRedirect, { replace: true });
    } catch (err) {
      setError(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/">
          <Brand />
        </Link>
        <div className="auth-message">
          <div className="auth-kicker">STUDENT PORTAL</div>
          <h1>
            Your pathway to
            <br />
            competitive
            <br />
            <span>excellence.</span>
          </h1>
          <p>
            Access official mock examinations, real-time all-India leaderboards, detailed performance analytics, and your secure student wallet.
          </p>
          <div className="auth-highlight">
            <CheckCircle2 size={18} /> Verified examination papers
            <CheckCircle2 size={18} /> Brevo email-secured login
          </div>
        </div>
        <div className="auth-left-bottom">LGW MERITX · LEARN. PRACTICE. RISE.</div>
        <div className="auth-decoration one" />
        <div className="auth-decoration two" />
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <Link to="/" className="auth-back">
            ← Back to website
          </Link>

          <span className="eyebrow">LGW DIGITAL HUB</span>
          <h2>Student Sign In</h2>
          <p className="auth-sub">
            Enter your student email and password to access your secure examination workspace.
          </p>

          {notice && (
            <div className="alert success">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{notice}</div>
            </div>
          )}

          {error && (
            <div className="alert error">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="student-email">Email Address</label>
              <input
                id="student-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
                disabled={busy || loading}
              />
            </div>

            <div className="field">
              <label htmlFor="student-password">Password</label>
              <div className="password-wrap">
                <input
                  id="student-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={busy || loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="remember-forgot-row">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={busy || loading}
                />
                Remember me
              </label>

              <Link to="/forgot-password" className="forgot-link">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={busy || loading}
            >
              {busy ? 'Signing in...' : 'Sign In as Student'} <ArrowRight size={17} />
            </button>
          </form>

          <p className="switch-auth">
            New student on LGW MeritX?{' '}
            <Link to="/register">Create New Account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
