import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Eye, EyeOff, Shield, Lock } from 'lucide-react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function AdminLogin() {
  const { login, logout, loading } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);

    try {
      // Authenticate with admin role enforcement (permits both ADMIN and SUPERADMIN)
      const u = await login(identifier, password, 'admin');
      const role = String(u?.role || '').toLowerCase();

      if (role !== 'admin' && role !== 'superadmin') {
        logout();
        setError('Access denied: Only authorized Admin and Super Admin accounts can access this portal.');
        return;
      }

      // Role-specific routing:
      // If Admin -> Admin Dashboard (/admin)
      // If Super Admin -> Super Admin Dashboard (/superadmin)
      if (role === 'superadmin') {
        nav('/superadmin');
      } else {
        nav('/admin');
      }
    } catch (err) {
      setError(err.message || 'Invalid administrator credentials.');
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
          <div className="auth-kicker">MANAGEMENT & FINANCE CONSOLE</div>
          <h1>
            Platform governance.
            <br />
            Examination control.
            <br />
            <span>Master overview.</span>
          </h1>
          <p>
            Monitor live proctoring telemetry, approve teacher test papers, oversee student registrations, and audit platform finances.
          </p>
          <div className="auth-highlight">
            <CheckCircle2 size={19} /> Live Proctoring Radar <CheckCircle2 size={19} /> Multi-Tier Wallet Audit
          </div>
        </div>
        <div className="auth-left-bottom">MERITX · ADMINISTRATIVE SECURITY</div>
        <div className="auth-decoration one" />
        <div className="auth-decoration two" />
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <Link to="/" className="auth-back">
            ← Back to website
          </Link>
          <span className="eyebrow" style={{ color: '#0f4c81' }}>ADMINISTRATION PORTAL</span>
          <h2>Administrator Sign In</h2>
          <p className="auth-sub">
            Enter your authorized credentials to access the Admin Dashboard or Super Admin Finance Console.
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
            <strong>Restricted Access:</strong> Public administrative registration is strictly disabled. Only pre-authorized accounts may authenticate.
          </div>

          {notice && <div className="alert success">{notice}</div>}
          {error && <div className="alert error">{error}</div>}

          <form onSubmit={submit}>
            <div className="field">
              <label>Administrator Username or Registered Email ID</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. admin@meritx.demo or superadmin@meritx.demo"
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
                  placeholder="Enter administrator password"
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
              {busy ? 'Authenticating...' : 'Sign In to Administrative Console'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
