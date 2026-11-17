# LGW MERITX — Node.js Backend & Neon PostgreSQL Database

Production-grade, secure, and maintainable backend for the **LGW MERITX Online Examination Platform**.

---

## 🚀 Technology Stack

- **Runtime & Framework**: Node.js (ES Modules, Node 20+) with Express.js
- **Database**: PostgreSQL hosted on **Neon Cloud**
- **ORM**: Prisma ORM v5
- **Authentication**: Signed JSON Web Tokens (JWT), refresh tokens, and bcrypt password hashing (10 salt rounds)
- **Validation**: Zod schema validation
- **Security**: Helmet security headers, CORS protection, and Express rate limiting
- **Payments**: Razorpay test-mode integration (with cryptographic HMAC-SHA256 signature verification)
- **Financial Accounting**: Strict integer paise balance calculations with double-entry ledger entries
- **Proctoring**: Granular webcam/microphone/fullscreen events, progressive warning counters, and automatic examination termination
- **API Documentation**: OpenAPI 3.0 / Swagger UI (`/api-docs`)

---

## 📁 Backend Architecture

```text
backend/
├── prisma/
│   ├── schema.prisma               # Normalized PostgreSQL schema with relations & indexes
│   ├── migrations/                 # Versioned migration history
│   │   └── 0_init/migration.sql    # Complete PostgreSQL DDL
│   └── seed.js                     # Idempotent database seeder
├── src/
│   ├── config/
│   │   ├── env.js                  # Strict environment parsing with Zod
│   │   ├── prisma.js               # Prisma client singleton & connection tester
│   │   └── swagger.js              # Swagger/OpenAPI interactive documentation
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT authentication & role-based authorization
│   │   ├── errorHandler.middleware.js # Centralized operational & unhandled error handler
│   │   ├── rateLimiter.middleware.js  # Global & auth rate limiters
│   │   └── validate.middleware.js  # Request body & query validator
│   ├── services/
│   │   ├── auth.service.js         # Register, Login, Google OAuth, Refresh, Logout
│   │   ├── student.service.js      # Dashboard, profile, courses, results
│   │   ├── exam.service.js         # Exam catalog, schedules, registration
│   │   ├── attempt.service.js      # Exam start, autosave, deadline enforcement, submission
│   │   ├── scoring.service.js      # Multi-pattern scoring engine (JEE, NEET, MHT-CET)
│   │   ├── question.service.js     # Questions CRUD, CSV imports, answer-key security
│   │   ├── teacher.service.js      # Papers, question bank approval lifecycle
│   │   ├── admin.service.js        # Overview stats, student list, content approvals
│   │   ├── finance.service.js      # Platform master wallet, revenues, payouts, reports
│   │   ├── wallet.service.js       # Integer paise accounting, deposits, withdrawals
│   │   ├── payment.service.js      # Razorpay order generation & signature verification
│   │   ├── proctoring.service.js   # Hardware heartbeat, events, 3-warning enforcement
│   │   └── leaderboard.service.js  # Deterministic 4-level tie breaking ranking & CSV export
│   ├── controllers/                # Thin controllers delegating to services
│   ├── routes/                     # REST API route declarations
│   │   └── index.js                # Master route mounting under /api and root aliases
│   ├── utils/
│   │   ├── apiResponse.js          # Standardized HTTP response helpers
│   │   ├── errors.js               # Typed domain exceptions (NotFoundError, UnauthorizedError, etc.)
│   │   └── logger.js               # Structured JSON logger
│   ├── app.js                      # Express application assembly
│   └── server.js                   # Server entrypoint and graceful shutdown
├── tests/                          # Automated tests using native Node.js test runner
│   ├── scoring.test.js             # Marking rules, JEE Adv partial marks, numerical tolerance
│   ├── auth-and-jwt.test.js        # Password hashing, JWT signing, role permissions
│   ├── wallet-accounting.test.js   # Integer paise calculations, signature verification
│   ├── leaderboard-and-proctoring.test.js # Deterministic tie-breaking, 3-warning rules
│   └── api-app.test.js             # Express app dispatch, health checks, Swagger docs
├── .env.example                    # Sample environment variables
├── package.json                    # Dependencies & scripts
└── README.md                       # Comprehensive setup & deployment guide
```

---

## 🔑 Demo Accounts

The database comes pre-seeded with these demo accounts:

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Student** | `student@meritx.demo` | `Student@123` | My Exams, Exam Catalog, Take Exam, Leaderboards, Results, Wallet |
| **Admin** | `admin@meritx.demo` | `Admin@123` | Exam Management, Questions, Results, Leaderboards, Live Proctoring |
| **Teacher** | `teacher@meritx.demo` | `Teacher@123` | Assigned Exams, Question Bank Authoring, Paper Builder |
| **Super Admin** | `superadmin@meritx.demo` | `Super@123` | Master Wallet, Payouts, Financial Reports, Audit Logs |

---

## 🛠️ Local Setup & Getting Started

### 1. Install Dependencies
```bash
npm install --prefix backend
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp backend/.env.example backend/.env
```

Set your **Neon PostgreSQL** connection strings:
```env
# Neon pooled connection for normal application queries
DATABASE_URL=postgresql://[user]:[password]@[neon-hostname]-pooler.us-east-2.aws.neon.tech/[dbname]?sslmode=require

# Neon direct connection for Prisma migrations
DIRECT_URL=postgresql://[user]:[password]@[neon-hostname].us-east-2.aws.neon.tech/[dbname]?sslmode=require
```

### 3. Generate Prisma Client & Run Migrations
```bash
npm run prisma:generate --prefix backend
npm run prisma:deploy --prefix backend
```

### 4. Seed Database
Seed examination patterns, initial exams, question banks, demo users, and course data:
```bash
npm run seed --prefix backend
```

### 5. Start the Server
```bash
# In development mode with hot reload:
npm run dev --prefix backend

# Or in production mode:
npm start --prefix backend
```

Server starts on **`http://localhost:5000`**.
API documentation is available at **`http://localhost:5000/api-docs`**.

---

## 🧪 Running Automated Tests

Run the full automated test suite:
```bash
npm test --prefix backend
```

Tests cover:
- ✅ Single-correct, multiple-correct, and numerical question evaluation
- ✅ JEE Advanced partial marking & numerical tolerances
- ✅ MHT-CET PCM two-phase weighting (Mathematics +2, zero negative)
- ✅ Password hashing (bcrypt) & JWT token signing and verification
- ✅ Role-based authorization & privilege escalation prevention
- ✅ Integer paise financial calculations & double-entry ledger records
- ✅ Razorpay HMAC-SHA256 signature verification
- ✅ Deterministic 4-level merit ranking & CSV export
- ✅ 3-Warning progressive enforcement and automated termination

---

## 🔒 Financial Safety & Compliance Rules

In accordance with Indian legal frameworks (Promotion and Regulation of Online Gaming Act, 2025):
- Real-money cash deposits and cash withdrawals are **disabled by default** (`ENABLE_REAL_MONEY=false`, `ENABLE_REAL_WITHDRAWALS=false`).
- Paid-entry competitions with cash prize distributions remain **disabled** (`ENABLE_PAID_ENTRY=false`, `ENABLE_CASH_PRIZES=false`).
- Virtual demo wallets operate strictly with non-purchasable, non-transferable **DMC credits**.
- Razorpay test mode requires explicitly configured test credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).

---

## 🌐 Connecting the Frontend

1. Ensure the frontend has `VITE_API_BASE_URL` configured in `frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```
2. Start the frontend:
   ```bash
   npm run dev --prefix frontend
   ```
3. Open `http://localhost:5173`. The frontend automatically sends real HTTP requests with JWT tokens to the backend!
