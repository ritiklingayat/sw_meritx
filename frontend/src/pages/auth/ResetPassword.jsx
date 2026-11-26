import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Circle,
  KeyRound
} from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { evaluatePasswordCriteria } from '../../lib/passwordValidation';
import './Auth.css';

export default function ResetPassword() {
  const { resetStudentPassword, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [email] = useState(location.state?.email || '');
  const [resetToken] = useState(location.state?.resetToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    !location.state?.resetToken
      ? 'Verification token is required. Please request a password reset code first.'
      : ''
  );
  const [notice, setNotice] = useState(
    location.state?.resetToken
      ? 'Email verified! Enter and confirm your new password below.'
      : ''
  );

  const { criteria, isPasswordValid } = evaluatePasswordCriteria(newPassword, confirmPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!resetToken) {
      setError('Invalid or missing verification session. Please request a new reset code.');
      return;
    }

    if (!isPasswordValid) {
      setError('Please ensure your new password satisfies all security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setBusy(true);

    try {
      await resetStudentPassword({
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword,
        confirmPassword
      });

      nav('/login', {
        state: {
          resetSuccess: true
        }
      });
    } catch (err) {
      setError(err?.message || 'Failed to update password. Please try again.');
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
          <div className="auth-kicker">PASSWORD RESET</div>
          <h1>
            Create your
            <br />
            new account
            <br />
            <span>password.</span>
          </h1>
          <p>
            Choose a strong, unique password to safeguard your test submissions, wallet balance, and exam history.
          </p>
          <div className="auth-highlight">
            <CheckCircle2 size={18} /> Minimum 8 characters
            <CheckCircle2 size={18} /> Encrypted password storage
          </div>
        </div>
        <div className="auth-left-bottom">LGW MERITX · LEARN. PRACTICE. RISE.</div>
        <div className="auth-decoration one" />
        <div className="auth-decoration two" />
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <Link to="/login" className="auth-back">
            ← Back to sign in
          </Link>

          <span className="eyebrow">STUDENT PORTAL</span>
          <h2>Set New Password</h2>
          <p className="auth-sub">
            Your verification has been confirmed. Enter and confirm your new student password below.
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

          {!resetToken ? (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/forgot-password" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '8px' }}>
                Go to Forgot Password
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="reset-new-password">New Password</label>
                <div className="password-wrap">
                  <input
                    id="reset-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
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

              <div className="field">
                <label htmlFor="reset-confirm-password">Confirm New Password</label>
                <div className="password-wrap">
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                    disabled={busy || loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="password-requirements">
                <div className="req-header">Password Security Checklist</div>
                <div className="req-grid">
                  <div className={`req-item ${criteria.minLength ? 'met' : ''}`}>
                    {criteria.minLength ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span>Minimum 8 characters</span>
                  </div>
                  <div className={`req-item ${criteria.hasUppercase ? 'met' : ''}`}>
                    {criteria.hasUppercase ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span>At least one uppercase</span>
                  </div>
                  <div className={`req-item ${criteria.hasLowercase ? 'met' : ''}`}>
                    {criteria.hasLowercase ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span>At least one lowercase</span>
                  </div>
                  <div className={`req-item ${criteria.hasNumber ? 'met' : ''}`}>
                    {criteria.hasNumber ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span>At least one number</span>
                  </div>
                  <div className={`req-item ${criteria.hasSpecial ? 'met' : ''}`}>
                    {criteria.hasSpecial ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span>One special character (!@#$)</span>
                  </div>
                  <div className={`req-item ${criteria.passwordsMatch ? 'met' : ''}`}>
                    {criteria.passwordsMatch ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={busy || loading}
              >
                {busy ? 'Updating Password...' : 'Reset Password'}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
          )}

          <p className="switch-auth">
            Return to <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
