import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Clock3,
  Users,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  BookOpen,
  CheckCircle2,
  Lock,
  ShieldCheck,
  AlertCircle,
  Timer,
} from 'lucide-react';
import { SiteFooter, SiteHeader, Empty, Loading } from '../../components/Layouts';
import { api, money, friendlyDate } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  getExamScheduleInfo,
  formatDateTime,
  formatDate,
  formatTime,
  formatExamWindow,
  formatCountdown,
} from '../../services/schedulingService';
import './Exams.css';

export function ExamCard({ exam, action }) {
  const [now, setNow] = useState(Date.now());

  // Live timer tick every 10 seconds for real-time schedule status updates
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const schedule = getExamScheduleInfo(exam, new Date(now));
  const isFeeHidden = exam.feeVisible === false;

  const symbol = exam.type?.startsWith('NEET')
    ? '✚'
    : exam.type?.toLowerCase().includes('java') || exam.type?.toLowerCase().includes('tech')
    ? '</>'
    : '∑';

  const statusColor =
    schedule.examStatus === 'Live'
      ? '#10b981'
      : schedule.examStatus === 'Starting Soon'
      ? '#f59e0b'
      : schedule.examStatus === 'Completed'
      ? '#64748b'
      : '#2563eb';

  return (
    <article className="exam-card" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top Tag & Status Badges */}
      <div className="exam-card-top" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={'exam-type ' + (exam.type?.startsWith('NEET') ? 'neet' : 'jee')}>
            {exam.type || 'Standard Exam'}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: 20,
              background: `${statusColor}18`,
              color: statusColor,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ● {schedule.examStatus === 'Starting Soon' ? schedule.countdownText : schedule.examStatus}
          </span>
        </div>

        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 20,
            background: schedule.isRegistrationOpen ? '#ecfdf5' : '#f1f5f9',
            color: schedule.isRegistrationOpen ? '#059669' : '#64748b',
          }}
        >
          {schedule.registrationStatus}
        </span>
      </div>

      {/* Symbol & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 6px' }}>
        <div className="exam-symbol" style={{ margin: 0, width: 50, height: 50, fontSize: 26, borderRadius: 14, flexShrink: 0 }}>
          {symbol}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.35, color: '#0f172a' }}>{exam.title}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{exam.subject}</p>
        </div>
      </div>

      {/* High-Visibility Complete Examination Schedule */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '12px 14px',
          margin: '12px 0 16px',
          display: 'grid',
          gap: 7,
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#334155' }}>
          <CalendarDays size={14} color="#3b82f6" />
          <span>
            Date: <strong>{formatDate(schedule.startsAt || exam.date)}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#334155' }}>
          <Clock3 size={14} color="#3b82f6" />
          <span>
            Window: <strong>{formatTime(schedule.startsAt)} – {formatTime(schedule.endsAt)}</strong>{' '}
            <span style={{ color: '#64748b', fontSize: 11 }}>({schedule.windowDurationMins}m window)</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#334155' }}>
          <Timer size={14} color="#3b82f6" />
          <span>
            Attempt Duration: <strong>{exam.duration || 60} Minutes</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#334155' }}>
          <BookOpen size={14} color="#3b82f6" />
          <span>
            Assessment: <strong>{exam.questions || 30} MCQs</strong> · <strong>{exam.marks || 100} Marks</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: schedule.proctoringRequired ? '#4f46e5' : '#64748b' }}>
          <ShieldCheck size={14} color={schedule.proctoringRequired ? '#4f46e5' : '#94a3b8'} />
          <span>
            Proctoring:{' '}
            <strong>{schedule.proctoringRequired ? 'Required (Camera & Mic AI)' : 'Standard (Disabled)'}</strong>
          </span>
        </div>
      </div>

      {/* Bottom Fee & Action Row */}
      <div className="exam-bottom" style={{ marginTop: 'auto', paddingTop: 14 }}>
        <div>
          <small style={{ fontSize: 10, letterSpacing: '0.05em', color: '#94a3b8' }}>REGISTRATION</small>
          {isFeeHidden ? (
            <Link to="/login" style={{ color: '#2563eb', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lock size={12} /> Login to view price
            </Link>
          ) : (
            <strong style={{ fontSize: 20, color: '#0f172a' }}>
              {exam.fee ? money(exam.fee) : 'FREE'}
            </strong>
          )}
        </div>
        {action || (
          <Link to={'/exams/' + exam.id} className="btn btn-primary small" style={{ fontWeight: 700 }}>
            View Details <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
    </article>
  );
}

export default function Exams() {
  const { token } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All Exams');

  useEffect(() => {
    api('/exams', { token })
      .then((d) => setExams(d.exams || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const shown = exams.filter(
    (e) =>
      (filter === 'All Exams' || e.type.includes(filter)) &&
      e.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <SiteHeader />
      <div className="exams-page">
        <div className="container">
          <div className="exams-heading">
            <span className="eyebrow">DISCOVER YOUR NEXT CHALLENGE</span>
            <h1>
              Discover. Prepare. <span className="gradient-text">Excel.</span>
            </h1>
            <p>
              Curated examinations designed to challenge you, sharpen your skills and elevate your rank.
            </p>
          </div>
          <div className="exam-controls">
            <div className="exam-search">
              <Search size={18} />
              <input
                aria-label="Search exams"
                placeholder="Search exams..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="exam-filter">
              <SlidersHorizontal size={17} />
              <select
                aria-label="Filter exam type"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option>All Exams</option>
                <option>JEE</option>
                <option>NEET</option>
              </select>
            </div>
          </div>
          {loading ? (
            <Loading />
          ) : shown.length ? (
            <div className="exam-list-grid">
              {shown.map((e) => (
                <ExamCard key={e.id} exam={e} />
              ))}
            </div>
          ) : (
            <Empty title="No matching exams" text="Try a different search or filter." />
          )}
          <div className="exam-note">
            <CheckCircle2 size={18} /> Paid examinations use secure student wallet & simulated Razorpay checkout.
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
