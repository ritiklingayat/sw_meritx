import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Eye, EyeOff, User, GraduationCap } from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import './Auth.css';

export default function Auth({ register = false }) {
  const { login, logout, googleLogin, loading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const googleBox = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('JEE Main');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.registered ? 'Registration successful! Please sign in to your student workspace.' : '');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId || !googleBox.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBox.current) return;
      googleBox.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError('');
          try {
            const user = await googleLogin(credential, target);
            if (user?.role !== 'student') {
              logout();
              setError('Access denied: Google sign-in is reserved for student accounts.');
              return;
            }
            nav('/student');
          } catch (issue) {
            setError(issue.message);
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBox.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: register ? 'signup_with' : 'continue_with',
        width: 320,
      });
    };
    if (window.google?.accounts?.id) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
    };
  }, [googleClientId, googleLogin, target, register, nav, logout]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (register) {
        await api('/auth/register', {
          method: 'POST',
          body: { name, email, password, target, role: 'student' },
        });
        nav('/login', { state: { registered: true } });
      } else {
        const u = await login(email, password, 'student');
        if (u?.role !== 'student') {
          logout();
          setError('Access denied: This portal is strictly for students. Teachers and Administrators must use their dedicated login portals.');
          return;
        }
        nav('/student');
      }
    } catch (e) {
      setError(e.message);
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
          <div className="auth-kicker">STUDENT WORKSPACE</div>
          <h1>
            The next big
            <br />
            achievement
            <br />
            <span>starts with you.</span>
          </h1>
          <p>Prepare with purpose. Practice with confidence. Make every attempt count.</p>
          <div className="auth-highlight">
            <CheckCircle2 size={19} /> Realistic mock tests <CheckCircle2 size={19} /> Integrated student wallet
          </div>
        </div>
        <div className="auth-left-bottom">MERITX · LEARN. PRACTICE. RISE.</div>
        <div className="auth-decoration one" />
        <div className="auth-decoration two" />
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <Link to="/" className="auth-back">
            ← Back to website
          </Link>
          <span className="eyebrow">STUDENT PORTAL</span>
          <h2>{register ? 'Create Student Account' : 'Student Sign In'}</h2>
          <p className="auth-sub">
            {register
              ? 'Join MERITX to access mock examinations, live tests, and performance analytics.'
              : 'Enter your student credentials to access your secure MERITX workspace.'}
          </p>

          {notice && <div className="alert success">{notice}</div>}
          {error && <div className="alert error">{error}</div>}

          <form onSubmit={submit}>
            {register && (
              <div className="field">
                <label>Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            <div className="field">
              <label>Student Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                required
              />
            </div>

            <div className="field">
              <label>Password</label>
              <div className="password-wrap">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  minLength={register ? 8 : 1}
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

            {register && (
              <div className="field">
                <label>Target Examination</label>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option>JEE Main</option>
                  <option>JEE Advanced</option>
                  <option>NEET UG</option>
                  <option>MHT-CET</option>
                </select>
              </div>
            )}

            <button className="btn btn-primary auth-submit" disabled={loading || busy}>
              {busy ? (register ? 'Creating account...' : 'Signing in...') : register ? 'Create Student Account' : 'Sign In as Student'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>

          {googleClientId && (
            <>
              <div className="auth-google-divider">
                <span>or</span>
              </div>
              <div className="auth-google-button" ref={googleBox} />
            </>
          )}

          <p className="switch-auth">
            {register ? 'Already have a student account?' : 'New student on Meritx?'}{' '}
            <Link to={register ? '/login' : '/register'}>{register ? 'Sign In' : 'Create an account'}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
