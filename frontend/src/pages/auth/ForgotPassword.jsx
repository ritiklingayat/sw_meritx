import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Mail
} from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { isValidEmail, maskEmailAddress } from '../../lib/passwordValidation';
import './Auth.css';

export default function ForgotPassword() {
  const { sendStudentOtp, verifyStudentOtp, resendStudentOtp, loading } = useAuth();
  const nav = useNavigate();

  // Steps: 1: enter email, 2: verify OTP (then redirects to /reset-password)
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // 6-digit OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  // Cooldown timer
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Focus on OTP input on step 2 transition
  useEffect(() => {
    if (step === 2 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // Step 1: Send reset code
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError('Please enter your valid registered student email address.');
      return;
    }

    setBusy(true);

    try {
      const res = await sendStudentOtp({
        email: cleanEmail,
        purpose: 'password_reset'
      });

      setMaskedEmail(res?.maskedEmail || res?.data?.maskedEmail || maskEmailAddress(cleanEmail));
      setCooldown(res?.cooldownSeconds || res?.data?.cooldownSeconds || 60);
      setNotice('A 6-digit password reset code has been sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Failed to send password reset code. Please check your email.');
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Handle OTP input
  const handleOtpChange = (index, value) => {
    const cleanDigits = value.replace(/\D/g, '');
    if (!cleanDigits) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      setError('');
      return;
    }

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

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      setError('');
      const focusIdx = Math.min(digits.length, 5);
      if (inputRefs.current[focusIdx]) inputRefs.current[focusIdx].focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit reset code.');
      return;
    }

    setBusy(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await verifyStudentOtp({
        email: cleanEmail,
        otp: code,
        purpose: 'password_reset'
      });

      const token = res?.verificationToken || res?.data?.verificationToken;
      if (!token) {
        throw new Error('Reset verification token missing from server response.');
      }

      // Navigate to /reset-password with single-use verified token in router state
      nav('/reset-password', {
        state: {
          email: cleanEmail,
          maskedEmail: maskedEmail || maskEmailAddress(cleanEmail),
          resetToken: token
        }
      });
    } catch (err) {
      setError(err?.message || 'Invalid or expired reset code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setNotice('');
    setResending(true);

    try {
      const res = await resendStudentOtp({
        email: email.trim().toLowerCase(),
        purpose: 'password_reset'
      });

      setCooldown(res?.cooldownSeconds || res?.data?.cooldownSeconds || 60);
      setNotice('A fresh 6-digit reset code has been sent to your email.');
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } catch (err) {
      setError(err?.message || 'Failed to resend code. Please wait.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/">
          <Brand />
        </Link>
        <div className="auth-message">
          <div className="auth-kicker">PASSWORD RECOVERY</div>
          <h1>
            Regain access
            <br />
            to your student
            <br />
            <span>workspace.</span>
          </h1>
          <p>
            Verify your identity with a secure Brevo email verification code to reset your account password.
          </p>
          <div className="auth-highlight">
            <CheckCircle2 size={18} /> Brevo OTP authentication
            <CheckCircle2 size={18} /> Immediate session protection
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

          <span className="eyebrow">STUDENT SECURITY</span>
          <h2>{step === 1 ? 'Forgot Password' : 'Verify Reset Code'}</h2>
          <p className="auth-sub">
            {step === 1
              ? 'Enter your registered student email address to receive a secure 6-digit reset code.'
              : 'We have sent a 6-digit verification code to your email address.'}
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

          {/* STEP 1: Enter Email */}
          {step === 1 && (
            <form onSubmit={handleSendCode} noValidate>
              <div className="field">
                <label htmlFor="forgot-email">Student Email Address</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  autoComplete="email"
                  required
                  disabled={busy || loading}
                />
              </div>

              <button
                type="submit"
                className="auth-submit"
                disabled={busy || loading}
              >
                {busy ? 'Sending Reset Code via Brevo...' : 'Send Reset Code'}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="otp-container-ui">
              {maskedEmail && (
                <div className="otp-masked-badge">
                  <Mail size={14} />
                  <span>Code sent to: {maskedEmail}</span>
                </div>
              )}

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
                {busy ? 'Verifying Code...' : 'Verify OTP & Continue'}{' '}
                <ArrowRight size={17} />
              </button>
            </form>
          )}

          <p className="switch-auth">
            Remember your password? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
