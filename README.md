# MERITX — Online Examination & Merit Platform (Full-Stack Edition)

**MERITX** is a commercial-grade competitive examination platform built with **React** on the frontend and **Node.js, Express, PostgreSQL (Neon Cloud), and Prisma ORM** on the backend.

It features full-screen examination delivery (`100vh / 100dvh` zero unwanted scrolling), multi-pattern server-side scoring (JEE Main, JEE Advanced partial marking, NEET UG, MHT-CET PCM 2-phase), live proctoring (camera, mic, tab-switch, fullscreen with 3-warning enforcement), deterministic examination-wise leaderboards with podium rankings, double-entry integer paise wallet accounting, and role-based access control across **Student, Teacher, Admin, and Superadmin** portals.

---

## 🏛️ System Architecture

```text
LGW-MERITX/
├── backend/                         # Node.js + Express + Prisma + Neon REST API
│   ├── prisma/
│   │   ├── schema.prisma            # Normalized PostgreSQL relational models
│   │   ├── seed.js                  # Database seeder (exams, patterns, users, questions)
│   │   └── migrations/              # DDL migrations
│   ├── src/
│   │   ├── app.js                   # Express application setup, security, Swagger
│   │   ├── server.js                # Server entry point & graceful shutdown
│   │   ├── config/                  # Prisma client, env, Swagger specs
│   │   ├── controllers/             # Auth, Student, Exam, Attempt, Teacher, Admin, Finance, Proctoring
│   │   ├── middleware/              # JWT auth, role hierarchy, rate limiting, error handling, Zod validation
│   │   ├── routes/                  # Express REST routes
│   │   ├── services/                # Scoring engine, exam lifecycle, wallet, proctoring, leaderboard
│   │   └── utils/                   # Logger, errors, API response formatter
│   └── tests/                       # Automated Node.js test suite (17/17 passing)
│
├── frontend/                        # React 19 + Vite 7 SPA
│   ├── src/
│   │   ├── App.jsx                  # Role-guarded routing
│   │   ├── lib/api.js               # REST API client pointing to VITE_API_BASE_URL (with offline fallback)
│   │   ├── context/AuthContext.jsx  # Authentication state & role switching
│   │   ├── components/              # Layouts, QuestionRenderer, Brand, ErrorBoundary
│   │   ├── pages/
│   │   │   ├── exam/                # Full-screen zero-scroll examination UI & result review
│   │   │   ├── student/             # Dashboard, My Exams, Leaderboard, Wallet, Profile
│   │   │   ├── teacher/             # Paper authoring & question bank management
│   │   │   ├── admin/               # Catalog, Questions, Leaderboards, Proctoring, Results
│   │   │   ├── superadmin/          # Finance command, ledger, audit logs
│   │   │   └── public/              # Home, Exam Catalog, Exam Details
│   │   └── services/                # Clean frontend service layer
│   └── vite.config.js               # Dev server with /api proxy to backend (port 5000)
│
├── workbooks/                       # Standard examination CSV workbooks
│   ├── LGW_MeritX_JEE_Main_75.csv
│   ├── LGW_MeritX_JEE_Advanced_102.csv
│   ├── LGW_MeritX_MHT_CET_PCM_150.csv
│   └── LGW_MeritX_NEET_UG_180.csv
└── package.json                     # Monorepo convenience scripts
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
# Install root, backend, and frontend packages
npm install --prefix backend
npm install --prefix frontend
```

### 2. Configure Environment Variables
Backend: copy `backend/.env.example` to `backend/.env` and provide your Neon PostgreSQL credentials:
```env
DATABASE_URL="postgresql://neondb_owner:<password>@<neon-host>/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:<password>@<neon-host>/neondb?sslmode=require"
JWT_SECRET="meritx_super_secret_jwt_key_min_32_chars"
JWT_REFRESH_SECRET="meritx_super_secret_refresh_jwt_key_min_32_chars"
PORT=5000
FRONTEND_URL="http://localhost:5173"
ENABLE_REAL_MONEY=false
ENABLE_REAL_WITHDRAWALS=false
ENABLE_PAID_ENTRY=false
ENABLE_CASH_PRIZES=false
```

Frontend: `frontend/.env` is pre-configured:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### 3. Migrate and Seed Neon Database
```bash
# Apply schema to Neon PostgreSQL
npm run prisma:deploy --prefix backend

# Seed default patterns, exams, questions, users, and demo wallets
npm run seed --prefix backend
```

### 4. Run Both Servers
```bash
# Terminal 1 - Backend (port 5000)
npm run dev:backend

# Terminal 2 - Frontend (port 5173)
npm run dev:frontend
```

Open **`http://localhost:5173/`** in your browser.  
Swagger API Documentation is available at **`http://localhost:5000/api/docs`**.

---

## 🔑 Demo Credentials

Click any role pill on `/login` to auto-populate credentials:

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Student** | `student@meritx.demo` | `Student@123` | My Exams, Exam Catalog, Take Exam, Leaderboards, My Results, Wallet |
| **Admin** | `admin@meritx.demo` | `Admin@123` | Exam Management, Questions Editor, Results, Leaderboards, Live Proctoring |
| **Teacher** | `teacher@meritx.demo` | `Teacher@123` | Assigned Exams, Question Bank Authoring, Paper Builder |
| **Super Admin** | `superadmin@meritx.demo` | `Super@123` | Master Wallet, Payouts, Financial Reports, Audit Logs |

---

## 🧪 Testing & Verification

Run the comprehensive automated backend test suite:
```bash
npm test --prefix backend
```
Verifies 17 mission-critical capabilities:
- Express app routing, 404 handler, and Swagger generation
- bcrypt password hashing and JWT token signing/verification
- Role hierarchy and authorization middleware
- Multi-pattern scoring engine (JEE Main, JEE Advanced partial marking, NEET UG, MHT-CET PCM 2-phase)
- Numerical tolerance matching
- Strict integer paise wallet balance calculations & double-entry ledger
- Razorpay HMAC SHA256 payment signature verification
- Proctoring 3-warning progressive enforcement logic
- Deterministic 4-level leaderboard tie-breaking

---

## ⚖️ Indian Online Gaming Legal Compliance (Act 32 of 2025)

The platform is engineered with strict adherence to Indian legal and regulatory standards:
- Real-money deposits, withdrawals, paid tournament entry, and cash prize payouts are disabled by default (`ENABLE_REAL_MONEY=false`).
- All calculations are conducted using integer paise (`BigInt`) to completely prevent IEEE 754 floating-point balance corruption.
- Audit trails and immutable ledger entries are recorded for every state change.
