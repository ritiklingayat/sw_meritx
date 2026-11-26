import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  X
} from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { evaluatePasswordCriteria, isValidEmail, maskEmailAddress } from '../../lib/passwordValidation';
import './Auth.css';

export default function StudentRegister() {
  const { sendStudentOtp, loading } = useAuth();
  const nav = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [target, setTarget] = useState('JEE Main');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Real-time password validation criteria
  const { criteria, isPasswordValid } = evaluatePasswordCriteria(password, confirmPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid student email address.');
      return;
    }

    if (!isPasswordValid) {
      setError('Please ensure your password satisfies all 5 security requirements below.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    if (!agreeTerms) {
      setError('You must agree to the Terms & Conditions and Privacy Policy to register.');
      return;
    }

    setBusy(true);

    try {
      // Initiate OTP delivery via Brevo Transactional Email API
      const res = await sendStudentOtp({
        name: cleanName,
        email: cleanEmail,
        target,
        purpose: 'registration'
      });

      // Proceed to the email OTP verification step with in-memory state
      nav('/verify-email', {
        state: {
          name: cleanName,
          email: cleanEmail,
          target,
          password,
          confirmPassword,
          purpose: 'registration',
          maskedEmail: res?.maskedEmail || maskEmailAddress(cleanEmail),
          cooldownSeconds: res?.cooldownSeconds || 60,
          initialNotice: 'A 6-digit verification code has been sent to your email.'
        }
      });
    } catch (err) {
      setError(err?.message || 'Failed to send verification code. Please try again.');
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
          <div className="auth-kicker">STUDENT REGISTRATION</div>
          <h1>
            Begin your
            <br />
            exam preparation
            <br />
            <span>journey today.</span>
          </h1>
          <p>
            Create your official LGW MeritX student profile to experience authentic test interfaces, proctored mock assessments, and national percentile tracking.
          </p>
          <div className="auth-highlight">
            <CheckCircle2 size={18} /> Official Brevo Email OTP
            <CheckCircle2 size={18} /> Instant student wallet
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
          <h2>Create Student Account</h2>
          <p className="auth-sub">
            Fill in your registration details. We will send a secure 6-digit OTP to verify your email address.
          </p>

          {error && (
            <div className="alert error">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aditi Sharma"
                autoComplete="name"
                required
                disabled={busy || loading}
              />
            </div>

            <div className="field">
              <label htmlFor="reg-email">Student Email Address</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                autoComplete="email"
                required
                disabled={busy || loading}
              />
            </div>

            <div className="field">
              <label htmlFor="reg-target">Target Examination</label>
              <select
                id="reg-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={busy || loading}
              >
                <option value="JEE Main">JEE Main (Engineering)</option>
                <option value="JEE Advanced">JEE Advanced (IIT)</option>
                <option value="NEET UG">NEET UG (Medical)</option>
                <option value="MHT-CET">MHT-CET (PCM/PCB)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="reg-password">Password</label>
              <div className="password-wrap">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
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
              <label htmlFor="reg-confirm-password">Confirm Password</label>
              <div className="password-wrap">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
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

            {/* Real-Time Password Requirements Indicators */}
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

            {/* Terms and Privacy Policy Checkbox */}
            <div className="terms-row">
              <input
                id="agree-terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                disabled={busy || loading}
              />
              <label htmlFor="agree-terms">
                I agree to the{' '}
                <button
                  type="button"
                  className="terms-link"
                  onClick={() => setShowPrivacyModal(true)}
                >
                  Terms &amp; Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  className="terms-link"
                  onClick={() => setShowPrivacyModal(true)}
                >
                  Privacy Policy
                </button>
                .
              </label>
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={busy || loading}
            >
              {busy ? 'Sending OTP via Brevo...' : 'Send OTP & Continue'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="switch-auth">
            Already have a student account?{' '}
            <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>

      {/* Privacy Policy & Terms Modal */}
      {showPrivacyModal && (
        <div className="modal-backdrop" onClick={() => setShowPrivacyModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Terms of Service &amp; Privacy Policy</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowPrivacyModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>1. Student Account Governance:</strong> Registration on the LGW MeritX (LGW Digital Hub) examination platform grants candidates personal access to mock tests, practice papers, score reports, and national leaderboards.
              </p>
              <p>
                <strong>2. Verification &amp; Security:</strong> Student accounts require mandatory email verification via official Brevo Transactional Email OTP. Credentials, OTP codes, and exam access keys must remain confidential.
              </p>
              <p>
                <strong>3. Examination Integrity:</strong> Tests delivered through LGW MeritX are monitored with progressive proctoring enforcement (fullscreen, camera, tab-switch monitoring). Violations may invalidate attempts.
              </p>
              <p>
                <strong>4. Data Privacy:</strong> We strictly safeguard your personal details, test results, and transaction records. We do not sell or distribute student data to third parties.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '8px 20px', borderRadius: '8px' }}
                onClick={() => {
                  setAgreeTerms(true);
                  setShowPrivacyModal(false);
                }}
              >
                I Understand &amp; Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
