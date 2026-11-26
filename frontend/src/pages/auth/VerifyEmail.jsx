import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  RotateCw,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { evaluatePasswordCriteria, maskEmailAddress } from '../../lib/passwordValidation';
import './Auth.css';

export default function VerifyEmail() {
  const { verifyStudentOtp, resendStudentOtp, completeStudentRegistration, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const initialEmail = location.state?.email || '';
  const [email] = useState(initialEmail);
  const [name] = useState(location.state?.name || '');
  const [target] = useState(location.state?.target || 'JEE Main');
  const [password, setPassword] = useState(location.state?.password || '');
  const [confirmPassword, setConfirmPassword] = useState(location.state?.confirmPassword || '');
  const [maskedEmail] = useState(
    location.state?.maskedEmail || (initialEmail ? maskEmailAddress(initialEmail) : '')
  );

  // OTP inputs state: 6 boxes
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  // Timer cooldown state (starts at 60s or location state)
  const [cooldown, setCooldown] = useState(location.state?.cooldownSeconds ?? 60);
  const [resending, setResending] = useState(false);

  // UI flow states
  const [isVerified, setIsVerified] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.initialNotice || '');

  // Final confirmation step password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { criteria, isPasswordValid } = evaluatePasswordCriteria(password, confirmPassword);

  // Countdown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first input on mount
  useEffect(() => {
    if (email && !isVerified && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [email, isVerified]);

  // Redirect cleanly after displaying completion success message
  useEffect(() => {
    if (!registrationComplete) return;
    const timer = setTimeout(() => {
      nav('/student', { replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [registrationComplete, nav]);

  // Handle individual OTP box typing
  const handleOtpChange = (index, value) => {
    const cleanDigits = value.replace(/\D/g, '');
    if (!cleanDigits) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      setError('');
      return;
    }

    // Handle multi-digit input (e.g. mobile SMS autofill or quick paste)
    if (cleanDigits.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < 6 && index + i < 6; i++) {
        newOtp[index + i] = cleanDigits[i] || '';
      }
      setOtp(newOtp);
      setError('');
      const focusIdx = Math.min(index + cleanDigits.length, 5);
      if (inputRefs.current[focusIdx]) inputRefs.current[focusIdx].focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleanDigits;
    setOtp(newOtp);
    setError('');

    if (index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle Backspace & Arrow navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0 && inputRefs.current[index - 1]) {
      e.preventDefault();
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5 && inputRefs.current[index + 1]) {
      e.preventDefault();
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle pasting complete 6-digit OTP
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteText = e.clipboardData.getData('text').trim();
    const digits = pasteText.replace(/\D/g, '').slice(0, 6);

    if (digits.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      setError('');

      const focusIdx = Math.min(digits.length, 5);
      if (inputRefs.current[focusIdx]) {
        inputRefs.current[focusIdx].focus();
      }
    }
  };

  // Verify OTP submission
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setNotice('');

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    if (!email) {
      setError('Registration session expired. Please start registration again.');
      return;
    }

    setBusy(true);

    try {
      const res = await verifyStudentOtp({
        email: email.trim().toLowerCase(),
        otp: fullCode,
        purpose: 'registration'
      });

      const token = res?.verificationToken || res?.data?.verificationToken;
      if (!token) {
        throw new Error('Verification token missing from server response.');
      }
      setVerificationToken(token);
      setIsVerified(true);
      setNotice('Email verified successfully! Review your details below and complete registration.');
    } catch (err) {
      setError(err?.message || 'Invalid or expired verification code. Please check and try again.');
    } finally {
      setBusy(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;
    setError('');
    setNotice('');
    setResending(true);

    try {
      const res = await resendStudentOtp({
        email: email.trim().toLowerCase(),
        purpose: 'registration'
      });

      setCooldown(res?.cooldownSeconds || res?.data?.cooldownSeconds || 60);
      setNotice('A fresh 6-digit verification code has been sent to your email.');
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } catch (err) {
      setError(err?.message || 'Failed to resend verification code. Please wait and try again.');
    } finally {
      setResending(false);
    }
  };

  // Complete final student registration
  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!verificationToken) {
      setError('Email verification required. Please verify your OTP code first.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must satisfy all 5 security requirements (8+ chars, uppercase, lowercase, number, special character).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setBusy(true);

    try {
      await completeStudentRegistration({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        verificationToken,
        target
      });

      setNotice('Student account created and email verified! Redirecting to your Student Dashboard...');
      setRegistrationComplete(true);
    } catch (err) {
      setError(err?.message || 'Failed to complete registration. Please try again.');
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
          <div className="auth-kicker">EMAIL VERIFICATION</div>
          <h1>
            Secure your
            <br />
            student identity
            <br />
            <span>with Brevo OTP.</span>
          </h1>
          <p>
            LGW MeritX utilizes two-step email verification to ensure every student candidate account is authentic and protected.
          </p>
          <div className="auth-highlight">
            <CheckCircle2 size={18} /> Official Brevo Delivery
            <CheckCircle2 size={18} /> 5-minute single-use OTP
          </div>
        </div>
        <div className="auth-left-bottom">LGW MERITX · LEARN. PRACTICE. RISE.</div>
        <div className="auth-decoration one" />
        <div className="auth-decoration two" />
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <Link to="/register" className="auth-back">
            ← Back to registration
          </Link>

          {!email ? (
            <>
              <span className="eyebrow">REGISTRATION REQUIRED</span>
              <h2>Verify Your Email Address</h2>
              <p className="auth-sub">
                No active registration session was found. Please submit your student registration details first to receive a 6-digit verification code.
              </p>
              <Link to="/register" className="auth-submit" style={{ textDecoration: 'none' }}>
                Go to Student Registration <ArrowRight size={17} />
              </Link>
            </>
          ) : !isVerified ? (
            /* ================= STAGE 1: OTP VERIFICATION ================= */
            <>
              <span className="eyebrow">STEP 2 OF 3</span>
              <h2>Verify Your Email Address</h2>
              <p className="auth-sub">
                We have sent a 6-digit verification code to your email address.
              </p>

              {maskedEmail && (
                <div className="otp-masked-badge">
                  <Mail size={14} />
                  <span>Sent to: {maskedEmail}</span>
                </div>
              )}

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

              <form onSubmit={handleVerifyOtp} className="otp-container-ui">
                <div className="otp-box-row" onPaste={handlePaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                      className={`otp-input-box ${digit ? 'filled' : ''}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      disabled={busy || loading}
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                <div className="otp-meta-row">
                  <div className="otp-timer">
                    <Clock size={14} />
                    <span>Code expires in 5 minutes</span>
                  </div>

                  {cooldown > 0 ? (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Resend in <strong>{cooldown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="resend-btn"
                      onClick={handleResend}
                      disabled={resending || busy}
                    >
                      <RotateCw size={13} style={{ display: 'inline', marginRight: 4 }} />
                      {resending ? 'Sending...' : 'Resend OTP'}
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="auth-submit"
                  style={{ marginTop: '22px' }}
                  disabled={busy || loading}
                >
                  {busy ? 'Verifying OTP...' : 'Verify OTP'}{' '}
                  <ArrowRight size={17} />
                </button>
              </form>

              <p className="switch-auth">
                Wrong email address? <Link to="/register">Change Details</Link>
              </p>
            </>
          ) : (
            /* ================= STAGE 2: FINAL ACCOUNT CONFIRMATION ================= */
            <>
              <span className="eyebrow">STEP 3 OF 3</span>
              <h2>Confirm Student Account</h2>
              <p className="auth-sub">
                Your email has been verified. Review your credentials and complete your student registration.
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

              <div className="confirmation-card">
                <div className="confirmation-card-title">
                  <ShieldCheck size={16} /> Verified Candidate Profile
                </div>

                <div className="confirmation-row">
                  <span className="confirmation-label">Full Name:</span>
                  <span className="confirmation-value">{name || 'Student Candidate'}</span>
                </div>

                <div className="confirmation-row">
                  <span className="confirmation-label">Verified Email:</span>
                  <span className="confirmation-value">
                    {email} <span className="verified-pill">✓ Verified</span>
                  </span>
                </div>

                <div className="confirmation-row">
                  <span className="confirmation-label">Target Exam:</span>
                  <span className="confirmation-value">{target}</span>
                </div>

                <div className="confirmation-row">
                  <span className="confirmation-label">Assigned Role:</span>
                  <span className="confirmation-value">STUDENT</span>
                </div>
              </div>

              {registrationComplete ? (
                <Link to="/student" className="auth-submit" style={{ textDecoration: 'none' }}>
                  Open Student Dashboard <ArrowRight size={17} />
                </Link>
              ) : (
                <form onSubmit={handleCompleteRegistration} noValidate>
                  <div className="field">
                    <label htmlFor="confirm-pw">Password</label>
                    <div className="password-wrap">
                      <input
                        id="confirm-pw"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
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
                    <label htmlFor="confirm-pw-2">Confirm Password</label>
                    <div className="password-wrap">
                      <input
                        id="confirm-pw-2"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
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
                    style={{ marginTop: '10px' }}
                    disabled={busy || loading}
                  >
                    {busy ? 'Creating Your Account...' : 'Complete Registration'}{' '}
                    <ArrowRight size={17} />
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
