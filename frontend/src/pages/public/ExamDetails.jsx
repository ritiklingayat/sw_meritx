import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CalendarDays, Clock3, Users, Trophy, Check, ArrowLeft, ArrowRight, ShieldCheck, Wallet, Timer, AlertCircle } from 'lucide-react';
import { SiteHeader, SiteFooter, Loading } from '../../components/Layouts';
import { api, money, friendlyDate } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { getExamScheduleInfo, formatDateTime, formatExamWindow } from '../../services/schedulingService';
import { AddMoneyModal } from '../student/Student';

export default function ExamDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showTopUp, setShowTopUp] = useState(false);

  const handleMoneyAdded = (newBal) => {
    setWallet((prev) => ({
      ...(prev || {}),
      availableBalance: newBal,
      balance: newBal
    }));
    setError('');
  };

  const loadExamData = () => {
    setLoading(true);
    setError('');

    const fetchExam = api(`/exams/${id}`, { token })
      .then((data) => data.exam)
      .catch(() =>
        api('/exams', { token }).then((examData) => {
          const found = (examData?.exams || []).find((item) => item.id === id);
          if (!found) throw new Error('Examination not found. It may have been unlisted or removed.');
          return found;
        })
      );

    const fetchWallet = token
      ? api('/me/wallet', { token }).then((w) => setWallet(w.wallet || w)).catch(() => {})
      : Promise.resolve();

    Promise.all([fetchExam, fetchWallet])
      .then(([foundExam]) => {
        setExam(foundExam || null);
      })
      .catch((issue) => {
        setError(issue.message || 'Unable to load examination details.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadExamData();
  }, [id, token]);

  const schedule = getExamScheduleInfo(exam);

  async function enroll() {
    if (!user) { nav('/login'); return; }
    if (user.role !== 'student') { setError('Please use a student account to register.'); return; }
    if (!schedule.isRegistrationOpen) {
      setError(
        schedule.registrationStatus === 'Upcoming Registration'
          ? `Registration opens on ${formatDateTime(schedule.registrationOpensAt)}.`
          : 'Registration for this examination has closed.'
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api('/exams/register', { method: 'POST', token, body: { examId: id } });
      if (!res.success) {
        if (res.error === 'INSUFFICIENT_BALANCE') {
          setError(`Insufficient Wallet Balance. Available: ₹${res.balance}, Required: ₹${res.required}. Please recharge your student wallet.`);
        } else {
          setError(res.message || 'Registration could not be completed.');
        }
        setBusy(false);
        return;
      }
      setConfirmed(true);
    } catch (issue) {
      if (issue.message?.includes('already registered')) setConfirmed(true);
      else setError(issue.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  const config = exam?.configuration || {};
  const isFeeHidden = exam?.feeVisible === false;
  const ruleSummary = Object.entries(config.rules || {}).filter(([key]) => key !== 'subjectOverrides').map(([type, rule]) => `${type.replaceAll('_', ' ')}: +${rule.correct} correct${rule.incorrect ? `, ${rule.incorrect} incorrect` : ', no negative mark'}`).join(' · ');
  const overview = exam ? [
    ['Syllabus', exam.syllabus || 'Standard Entrance Examination Scope'],
    ['Subjects', exam.subject],
    ['Total Questions', `${exam.questions || 30} Multiple Choice Questions`],
    ['Maximum Marks', `${exam.marks || 100} Marks (Passing: ${exam.passingMarks || 40})`],
    ['Attempt Duration', `${exam.duration} Minutes`],
    ['Availability Window', formatExamWindow(schedule.startsAt, schedule.endsAt)],
    ['Registration Window', `${formatDateTime(schedule.registrationOpensAt)} to ${formatDateTime(schedule.registrationClosesAt)}`],
    ['Proctoring Policy', schedule.proctoringRequired ? 'Webcam, Audio & Window Focus Monitored' : 'Standard Assessment (Unproctored)'],
    ['Marking Scheme', ruleSummary || '+4 correct, -1 incorrect'],
    ['Registration Fee', isFeeHidden ? 'Login to view price' : exam.fee ? `Paid · ${money(exam.fee)}` : 'Free']
  ] : [];
  const rules = config.instructions || [
    'Register before starting the mock examination using your student wallet.',
    'Answers are securely saved in real time while the attempt is active.',
    'Candidate attempt countdown begins immediately after instruction verification.',
    schedule.proctoringRequired ? 'Proctoring is active: webcam and audio will be verified before start.' : 'Standard test mode.',
    'Once submitted or when the timer reaches zero, responses are automatically evaluated.'
  ];

  return (
    <>
      <SiteHeader />
      <div className="exams-page">
        <div className="container">
          <Link to="/exams" className="back-link">
            <ArrowLeft size={16} /> All Exams
          </Link>
          {loading ? (
            <Loading />
          ) : !exam ? (
            <div className="panel" style={{ textAlign: 'center', padding: '50px 20px', margin: '40px auto', maxWidth: 500 }}>
              <h3 style={{ fontSize: 20, marginBottom: 8, color: '#101a34' }}>{error || 'Examination Not Found'}</h3>
              <p style={{ color: '#657b9a', fontSize: 14, marginBottom: 24 }}>
                {error ? 'Could not load examination details from the server. Check your connection and retry.' : 'This examination is either unavailable or has been removed.'}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-primary small" onClick={loadExamData}>Try Again</button>
                <Link to="/exams" className="btn btn-outline small">Browse All Exams</Link>
              </div>
            </div>
          ) : (
            <div className="details-grid">
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <span className="tag">{exam.type}</span>
                  <span className={`tag ${schedule.isLive ? 'green' : schedule.isStartingSoon ? 'orange' : 'blue'}`}>
                    ● {schedule.examStatus}
                  </span>
                  <span className={`tag ${schedule.isRegistrationOpen ? 'green' : 'gray'}`}>
                    {schedule.registrationStatus}
                  </span>
                </div>
                <h1 className="details-title">{exam.title}</h1>
                <p className="section-sub">{exam.description}</p>
                <div className="panel" style={{ marginTop: 28 }}>
                  <h3>Official Examination Schedule & Specifications</h3>
                  <div className="details-facts">
                    {overview.map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="panel" style={{ marginTop: 19 }}>
                <h3>Exam Rules & Fairness Instructions</h3>
                {rules.map((rule) => (
                  <p key={rule} style={{ display: 'flex', alignItems: 'start', gap: 10, fontSize: 12, color: '#657b9a' }}>
                    <Check size={16} color="#1bc6a5" />
                    {rule}
                  </p>
                ))}
              </div>
            </div>
          )}

          {exam && (
            <aside className="panel details-side">
              <span className="eyebrow">EXAM SCHEDULE SUMMARY</span>
              <div className="details-meta">
                <CalendarDays size={18} />
                <span>{friendlyDate(schedule.startsAt || exam.date)}</span>
              </div>
              <div className="details-meta">
                <Clock3 size={18} />
                <span>Window: {formatTime(schedule.startsAt)} – {formatTime(schedule.endsAt)}</span>
              </div>
              <div className="details-meta">
                <Timer size={18} />
                <span>Attempt Duration: {exam.duration} minutes</span>
              </div>
              <div className="details-meta">
                <ShieldCheck size={18} />
                <span>{schedule.proctoringRequired ? 'Proctored (Webcam + Audio)' : 'Standard (No Proctoring)'}</span>
              </div>
              <div className="details-meta">
                <Trophy size={18} />
                <span>{exam.marks} maximum marks (Pass: {exam.passingMarks || 40})</span>
              </div>
              <div className="hr" />
              <small className="muted">REGISTRATION FEE</small>
              {isFeeHidden ? (
                <h2 style={{ fontSize: 22, margin: '7px 0', color: '#2563eb' }}>
                  <Link to="/login" style={{ color: '#2563eb' }}>Login to view price</Link>
                </h2>
              ) : (
                <h2 style={{ fontSize: 32, margin: '7px 0' }}>
                  {exam.fee ? money(exam.fee) : 'FREE'}
                </h2>
              )}

              {user && wallet && (
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, margin: '14px 0', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Your Wallet Balance:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ color: (wallet.availableBalance ?? 0) >= (exam.fee || 0) ? '#10b981' : '#ef4444' }}>
                      {money(wallet.availableBalance)}
                    </strong>
                    {(wallet.availableBalance ?? 0) < (exam.fee || 0) && (
                      <button
                        type="button"
                        className="btn btn-primary small"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => setShowTopUp(true)}
                      >
                        + Add Money
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isFeeHidden ? (
                <Link to="/login" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                  Sign in to Register for Exam <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <label style={{ display: 'flex', gap: 9, alignItems: 'start', fontSize: 12, color: '#64758e', margin: '20px 0' }}>
                    <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                    I agree to the examination schedule and understand that submission is final.
                  </label>
                  {error && (
                    <div className="alert error" style={{ marginBottom: 14 }}>
                      {error}
                      {error.includes('Insufficient') && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn btn-primary small"
                            style={{ width: '100%' }}
                            onClick={() => setShowTopUp(true)}
                          >
                            <Wallet size={14} /> Recharge Wallet Now via Razorpay / UPI
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {confirmed ? (
                    <>
                      <div className="alert success">Registration confirmed successfully!</div>
                      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => nav(`/take/${id}`)}>
                        Go to Examination Interface <ArrowRight size={16} />
                      </button>
                    </>
                  ) : !schedule.isRegistrationOpen ? (
                    <button
                      disabled
                      className="btn btn-soft"
                      style={{ width: '100%', cursor: 'not-allowed', opacity: 0.8 }}
                    >
                      {schedule.registrationStatus === 'Upcoming Registration'
                        ? `Registration Opens on ${formatDate(schedule.registrationOpensAt)}`
                        : 'Registration Closed'}
                    </button>
                  ) : exam.fee > 0 && (wallet?.availableBalance ?? 0) < exam.fee ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ width: '100%', borderColor: '#f59e0b', color: '#b45309' }}
                      onClick={() => setShowTopUp(true)}
                    >
                      <Wallet size={16} /> Add {money(exam.fee - (wallet?.availableBalance ?? 0))} to Wallet to Enroll
                    </button>
                  ) : (
                    <button
                      disabled={!accepted || busy}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={enroll}
                    >
                      {busy ? 'Processing Wallet Payment…' : exam.fee > 0 ? `Pay ${money(exam.fee)} from Wallet & Register` : 'Register for Exam (Free)'} <ArrowRight size={16} />
                    </button>
                  )}
                </>
              )}
              <p style={{ fontSize: 10, textAlign: 'center', color: '#9badc0', marginTop: 15 }}>
                <ShieldCheck size={12} style={{ verticalAlign: 'middle' }} /> Instant wallet deduction & verified attempt locking
              </p>
            </aside>
          )}
        </div>
      </div>

      {showTopUp && (
        <AddMoneyModal
          isOpen={showTopUp}
          onClose={() => setShowTopUp(false)}
          currentBalance={wallet?.availableBalance ?? 0}
          onMoneyAdded={handleMoneyAdded}
        />
      )}
      <SiteFooter />
    </>
  );
}
