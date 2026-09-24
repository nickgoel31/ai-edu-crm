# AI EDU CRM — Enterprise Multi-Tenant Admissions & Student Platform

AI EDU CRM is a modern, production-hardened multi-tenant CRM designed for colleges, universities, study-abroad consultancies, and vocational academies. Built with Next.js 14 App Router, PostgreSQL, Prisma ORM, and NextAuth.js, it combines pipeline management with autonomous AI conversational agents, ERP two-way sync, and banking-grade security.

---

## Architecture & Core Capabilities

### 1. Multi-Tenant Database Isolation
- Every query, mutation, and audit log is strictly scoped by the active user's `organizationId`.
- All database operations are executed via `getScopedPrismaClient(session)` in `lib/scoped-prisma.ts`, eliminating accidental cross-tenant data leaks at the ORM layer.

### 2. Role-Based Access Control (RBAC)
- **ADMIN**: Full system access, team invitations, integration secrets, ERP mapping, and compliance audit logs.
- **COUNSELOR**: Unrestricted access to Leads, Students, and AI Agent escalation queues. Access to Settings and User Management is restricted.
- **READONLY**: View-only across all modules. Mutating endpoints (`POST`, `PATCH`, `DELETE`) and server actions return `403 Forbidden`.

### 3. Lead Ingestion & Pipeline Management
- **Omnichannel Ingestion**: Webhook endpoints for **Meta Lead Ads**, **WhatsApp Business Cloud API**, and a scheduled cron for **Google Sheets** sync.
- **Phone Deduplication**: Matches incoming leads by phone number and updates existing records rather than producing duplicates.
- **Kanban Pipeline & Table View**: Drag-and-drop lead progression through Cold, Warm, Hot, Converting, and Lost stages with mandatory lost reason tracking and full audit logging.
- **Filter-Respecting CSV Exports**: Exports only leads matching active search, stage, source, and counselor filters.

### 4. Autonomous Conversational AI Agents
- Omnichannel support for **Retell AI Voice Agents**, **WhatsApp Bots**, and **Website Chat**.
- Webhook callback (`/api/webhooks/agent-conversation`) logs transcripts, token costs in paise, and outcomes.
- **Escalation Queue**: Conversations resulting in `ESCALATED` trigger real-time notification badges and are routed to counselor claiming queues.

### 5. Student Lifecycle & Fee Milestones
- **Lead-to-Student Conversion**: Seamless transition from qualified lead to enrolled student.
- **Document Checklist**: Driven by per-program templates with `PENDING` → `RECEIVED` → `VERIFIED` workflows.
- **Installment Tracking**: Fee progress bars, due dates, and overdue alerts.
- **Sensitive Field Encryption (AES-256-GCM)**: Sensitive document URLs (`Document.fileUrl`) are encrypted at rest using `lib/crypto.ts`.

### 6. ERP Two-Way Synchronization
- **Outbound Push**: Dispatches student records to institutional ERP webhooks when stage changes to `ENROLLED` with configurable field mapping.
- **Inbound Webhook**: Accepts fee, attendance, and exam updates from external ERPs matched by student external ID.
- **Sync Logs**: Observability table showing recent payloads, status codes, and error traces.

### 7. Notification System
- **In-App Notification Bell**: Real-time alerts for stalled leads ($3+$ days with no activity), overdue tuition installments, and unclaimed AI escalations.
- **Daily Digest**: Cron-driven daily summary dispatched via **Resend Email** or **WhatsApp Business Cloud API** based on user preference.

### 8. Self-Serve Commercial Signup & Onboarding
- **3-Step Signup Wizard**: Org creation → Plan selection (Self-Serve @ ₹4,999/mo, Self-Serve + Agents @ ₹14,999/mo, Managed @ ₹39,999/mo) → Checkout & instant provisioning.
- **First-Run Onboarding Checklist**: Live progress bar tracking lead source setup, counselor invites, document checklists, and payment plans.
- **PWA & Mobile Navigation**: Fixed bottom navigation on mobile devices with standalone PWA support.

### 9. Rate Limiting & Audit Logs
- **Rate Limiter**: Sliding-window limiter on public webhooks returning HTTP `429 Too Many Requests` with `Retry-After` headers.
- **Compliance Audit Log**: Searchable, filterable audit trail (`/settings/audit-log`) tracking all actor actions, timestamps, and JSON state diffs.

---

## Directory Structure

```
├── app/
│   ├── actions/                 # Next.js Server Actions (leads.ts)
│   ├── api/
│   │   ├── auth/                # NextAuth and self-serve registration
│   │   ├── billing/             # Checkout sessions and subscription verification
│   │   ├── onboarding/          # Milestone status and checklist dismissal
│   │   ├── leads/               # Lead CRUD, bulk actions, follow-ups
│   │   ├── students/            # Student profiles, documents, payments
│   │   ├── agents/              # Agent config, conversation logs, escalations
│   │   ├── reports/             # Recharts analytics and funnel stats
│   │   ├── cron/                # Scheduled daily digest and sync endpoints
│   │   ├── webhooks/            # Meta, WhatsApp, Agents, ERP, Sheets webhooks
│   │   └── settings/            # Team users, integrations, ERP, audit logs
│   ├── leads/                   # Kanban and table pipeline views
│   ├── students/                # Student registry and detail profile tabs
│   ├── agents/                  # AI fleet dashboard and escalation queue
│   ├── reports/                 # Funnel conversion and counselor ROI charts
│   ├── settings/                # Settings navigation, users, integrations, audit log
│   ├── register/                # 3-Step self-serve signup wizard
│   ├── login/                   # NextAuth credentials sign-in
│   ├── layout.tsx               # Root layout with PWA meta & SessionProvider
│   └── page.tsx                 # Dashboard overview with onboarding checklist
├── components/
│   ├── bottom-nav.tsx           # Mobile PWA bottom navigation bar
│   ├── dashboard-shell.tsx      # Layout shell coordinating sidebar & mobile nav
│   ├── sidebar.tsx              # Desktop collapsable sidebar
│   ├── topbar.tsx               # Topbar with notification bell & user menu
│   ├── leads/                   # Kanban board, lead cards, and table views
│   ├── students/                # Document checklists, payment bars, convert modal
│   ├── onboarding/              # Onboarding checklist widget
│   └── notifications/           # Notification bell dropdown and alert cards
├── lib/
│   ├── auth.ts                  # NextAuth credentials provider configuration
│   ├── crypto.ts                # AES-256-GCM authenticated encryption at rest
│   ├── prisma.ts                # Singleton Prisma client instance
│   ├── rbac.ts                  # Role assertions (assertAdmin, assertCanMutate)
│   ├── rate-limiter.ts          # Sliding-window rate limiter for webhooks
│   ├── scoped-prisma.ts         # Multi-tenant Prisma client auto-scoping
│   └── notifications.ts         # Digest generator, Resend email & WhatsApp dispatch
├── prisma/
│   └── schema.prisma            # Database models, relations, and enums
├── public/
│   └── manifest.json            # PWA Web App Manifest
└── scripts/
    ├── dev-db.ts                # Embedded PostgreSQL daemon server
    ├── test-hardening-and-security.ts # 45-point comprehensive security suite
    ├── test-notifications-flow.ts     # In-app alerts and digest verification
    └── test-erp-sync.ts               # Two-way ERP sync integration test
```

---

## Environment Variables Reference

Create a `.env` file in the root of the project:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@127.0.0.1:5432/ai_edu_crm?schema=public&connection_limit=1` |
| `NEXTAUTH_SECRET` | Random key used by NextAuth to sign JWT tokens | `super-secret-random-key-edu-crm-2026` |
| `NEXTAUTH_URL` | Base URL of the running application | `http://localhost:3000` |
| `ENCRYPTION_KEY` | 32-byte hex or base64 key for AES-256-GCM data encryption | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` |
| `CRON_SECRET` | Secret token required to trigger cron API endpoints | `crm-cron-daily-secret-key-2026` |
| `RESEND_API_KEY` | API key for Resend email service (optional, falls back to simulation) | `re_1234567890` |
| `RESEND_FROM_EMAIL`| Sender email for notifications | `admissions@yourdomain.edu` |
| `WHATSAPP_API_TOKEN`| Meta WhatsApp Cloud API access token | `EAA...` |
| `WHATSAPP_PHONE_NUMBER_ID`| WhatsApp Business phone number ID | `1029384756` |
| `STRIPE_SECRET_KEY`| Stripe secret key for live card processing | `sk_test_...` |

---

## Getting Started (Local Development)

### 1. Prerequisites
- **Node.js**: v18.17.0 or higher (v20+ recommended)
- **npm** or **pnpm**
- **PostgreSQL**: Local PostgreSQL instance, or the included embedded server

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Database Server
If using the bundled lightweight database server:
```bash
npm run db:server
```

### 4. Apply Database Schema
Synchronize the Prisma models with your database:
```bash
npx prisma db push
```

*(Optional)* Launch Prisma Studio to visually inspect database tables:
```bash
npx prisma studio
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Verification Tests

The test suites validate multi-tenant isolation, AES-256-GCM encryption, rate limiting, and RBAC:

```bash
# 1. Comprehensive Security, Scoping & Hardening Test (45 Tests)
npx tsx scripts/test-hardening-and-security.ts

# 2. Notification Engine & Daily Digest Test
npx tsx scripts/test-notifications-flow.ts

# 3. Two-Way ERP Sync & Webhooks Test
npx tsx scripts/test-erp-sync.ts
```

---

## Production Build & Deployment

To generate an optimized production bundle:
```bash
npm run build
npm run start
```

---

## Security & Compliance Checklist for Operators

1. **Keep Secrets Secure**: Never commit real `ENCRYPTION_KEY` or `NEXTAUTH_SECRET` to version control.
2. **Backups**: Standard PostgreSQL pg_dump backups preserve encrypted fields without exposing plaintext documents.
3. **Webhook Endpoints**: When configuring webhooks in Meta Ads Manager or Retell AI, use unique tenant tokens or pass `organizationId` in the query string or authorization header.
