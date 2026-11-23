import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Eye, EyeOff, GraduationCap, BookOpen, KeyRound } from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Auth.css';

export default function TeacherLogin() {
  const { login, logout, loading } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotNotice, setForgotNotice] = useState('');
  const [forgotError, setForgotError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);

    try {
      // Authenticate with role enforcement
      const u = await login(identifier, password, 'teacher');
      if (u?.role !== 'teacher') {
        logout();
        setError('Access denied: Only accounts with the Teacher role can access the Teacher Dashboard.');
        return;
      }
      // Redirect to Teacher Dashboard
      nav('/teacher');
    } catch (err) {
      setError(err.message || 'Invalid teacher credentials.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotNotice('');
    setForgotError('');
    setForgotBusy(true);

    try {
      const res = await api('/auth/forgot-password', {
        method: 'POST',
        body: { identifier: forgotInput, email: forgotInput },
      });
      setForgotNotice(res?.message || 'Password reset link sent to your registered email address.');
    } catch (err) {
      setForgotError(err.message || 'Failed to send password reset link.');
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/">
          <Brand />
        </Link>
        <div className="auth-message">
          <div className="auth-kicker">FACULTY & TEACHER WORKSPACE</div>
          <h1>
            Empower learning.
            <br />
            Author excellence.
            <br />
            <span>Guide the next rise.</span>
          </h1>
          <p>
            Manage question banks, author comprehensive test papers, and monitor student assessment metrics.
          </p>
          <div className="auth-highlight">
            <CheckCircle2 size={19} /> Question Bank Management <CheckCircle2 size={19} /> Paper Authoring Studio
          </div>
        </div>
        <div className="auth-left-bottom">MERITX · FACULTY COMMAND</div>
        <div className="auth-decoration one" />
        <div className="auth-decoration two" />
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <Link to="/" className="auth-back">
            ← Back to website
          </Link>
          <span className="eyebrow" style={{ color: '#0d5db8' }}>TEACHER PORTAL</span>
          <h2>Teacher Sign In</h2>
          <p className="auth-sub">
            Enter your username or registered teacher email ID to access your faculty dashboard.
          </p>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#475569',
              marginBottom: '20px',
            }}
          >
            <strong>Restricted Access:</strong> Only registered and authorized faculty can log in here. Public registration is not permitted.
          </div>

          {notice && <div className="alert success">{notice}</div>}
          {error && <div className="alert error">{error}</div>}

          {!forgotOpen ? (
            <form onSubmit={submit}>
              <div className="field">
                <label>Teacher Username or Registered Email ID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. teacher@meritx.demo or teacher"
                  required
                />
              </div>

              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotInput(identifier);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: '4px',
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="password-wrap">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button className="btn btn-primary auth-submit" disabled={loading || busy}>
                {busy ? 'Verifying faculty access...' : 'Sign In to Teacher Dashboard'}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <div
              style={{
                background: '#f0f7ff',
                border: '1px solid #cce3fd',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d4ed8', marginBottom: '8px' }}>
                <KeyRound size={18} />
                <strong style={{ fontSize: '14px' }}>Reset Teacher Password</strong>
              </div>
              <p style={{ fontSize: '12px', color: '#475569', marginBottom: '14px' }}>
                Enter your registered teacher email or username. We will dispatch reset instructions.
              </p>

              {forgotNotice && <div className="alert success">{forgotNotice}</div>}
              {forgotError && <div className="alert error">{forgotError}</div>}

              <form onSubmit={handleForgotPassword}>
                <div className="field">
                  <input
                    type="text"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    placeholder="teacher@meritx.demo"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary small"
                    disabled={forgotBusy}
                    style={{ flex: 1 }}
                  >
                    {forgotBusy ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft small"
                    onClick={() => {
                      setForgotOpen(false);
                      setForgotNotice('');
                      setForgotError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
