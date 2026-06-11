# Talking Portfolio Risk

An orchestrator and web control panel that runs the Portfolio Optimizer on a saved portfolio, then has an AI voice agent call the operator's own phone to discuss the result live.

**MVP scope: self-call only.** The system only dials phone numbers the operator owns and has manually confirmed. A pluggable `RecipientPolicy` framework means a "consenting clients" tier can be added later without touching the call flow.

> Educational use only. Not financial or legal advice. See [DISCLAIMER](#disclaimer).

---

## Architecture

```
 manual / cron ──► Talking Portfolio (monorepo)
                   Web UI (React :5180) ──► Orchestrator (Node :5179)
                        │                          │
                  RecipientPolicy               compliance/<job_id>/
                  (SelfCallPolicy)              report_pack.json
                  CallerProfile {entity}        report.html / .pdf
                                                admin_log.md
                                                transcript.txt
                                                manifest.json (sha256)
                                                events.jsonl
                        │ HTTP                       │ HTTP
          ┌─────────────────────┐      ┌──────────────────────────┐
          │  optimizer/          │      │  call-agent/             │
          │  FastAPI :8077       │      │  Gemini Live + Twilio    │
          └─────────────────────┘      └──────────┬───────────────┘
                                         Your own (allowlisted) phone
```

All five services live in this repo:

| Directory | Role | Port |
|---|---|---|
| `backend/` | Orchestrator — Express, Prisma, policy framework, compliance bundle | :5179 |
| `frontend/` | Web control panel — React | :5180 |
| `optimizer/` | Portfolio Optimizer — FastAPI + Riskfolio-Lib | :8077 |
| `optimizer-web/` | Optimizer standalone UI — React/Vite | :5181 |
| `call-agent/` | Voice call agent — Node/TS + Twilio + Gemini Live | :3334 |

---

## Build Status

| Phase | Description | Status |
|---|---|---|
| P1 | Optimizer headless mode + `/api/talking/run` + `/api/talking/pack` | ✅ Done |
| P2 | Orchestrator scaffold — Express, Prisma, registries, compliance dir, web UI | ✅ Done |
| P3 | Policy framework wired end-to-end, SelfCallPolicy + CallerProfile disclosures, owned-numbers guard, WS broadcasts | ✅ Done |
| P4 | Call agent `/api/talking-call/dispatch`, grounded prompt, transcript relay | ✅ Done |
| P5 | News lookup (Brave) | Planned |
| P6 | Constrained rerun + `send_report` delivery | Planned |
| P7 | ManagedClientPolicy + hosted consent form | Planned |
| P8 | Maker-checker approval (scaffolded, flag off) | Scaffolded |
| P9 | Event-driven triggers (scaffolded, flag off) | Scaffolded |
| P10 | Inbound calls (scaffolded, flag off) | Scaffolded |

---

## Prerequisites

- Node 20+
- Python 3.10+ (for `optimizer/`)
- [ngrok](https://ngrok.com/) (free tier; a static domain avoids per-restart URL churn)
- Twilio account with a phone number
- Google Gemini API key

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/markcam1/talking-portfolio-risk
cd talking-portfolio-risk
cp .env.example .env   # fill in your values (see below)

cd backend && npm install && npm run db:migrate && cd ..
cd frontend && npm install && cd ..
cd call-agent && npm install && cd ..
cd optimizer-web && npm install && cd ..

# Create the optimizer Python venv
cd optimizer && python3 -m venv venv && venv/bin/pip install -r requirements.txt && cd ..
```

### 2. Configure `.env`

```env
# Internal service URLs (all local)
OPTIMIZER_BASE_URL=http://127.0.0.1:8077
CALL_AGENT_BASE_URL=http://127.0.0.1:3334

# Safety boundary — only verified owned numbers can be called
OWNED_NUMBERS_ONLY=true

# Keep true for all testing; only flip after P7 is counsel-reviewed
MOCK_MODE=true

# Your entity name and callback number for disclosures
DEFAULT_ENTITY_NAME="Your Name"
DEFAULT_CALLBACK_NUMBER=+15550001234

# SMTP — Mailpit for local dev (free, nothing leaves the machine)
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
```

Secrets (Twilio, Gemini, Brave) go in `call-agent/.env` and are **never** committed.

### 3. Start the full stack

```bash
scripts/dev.sh
```

This starts everything in the background:
1. **ngrok** on port 3334 → polls for the public URL → writes it into `call-agent/.env` as `PUBLIC_URL`
2. **Portfolio Optimizer** (`optimizer/`) on :8077
3. **Call Agent** (`call-agent/`) on :3334
4. **Orchestrator** (`backend/`) on :5179
5. **Web UI** (`frontend/`) on :5180
6. **Optimizer Web** (`optimizer-web/`) on :5181

URLs and health status are printed on completion. Logs go to `logs/<svc>.log` (rewritten on each restart).

```bash
scripts/dev-stop.sh                    # kill everything
scripts/dev-logs.sh [svc]             # tail a log (optimizer|callagent|orchestrator|web|optimizer-web)
scripts/dev-clear-compliance.sh        # remove all dev compliance bundles
scripts/dev-clear-compliance.sh <id>   # remove one job's bundle
```

### 4. Add your phone number

Web UI → **Owned Numbers** → enter your E.164 number → click **"I confirm I own this number"**.

This is the MVP safety boundary. No call is placed to any number that isn't in this list.

### 5. Run a call

Web UI → **Run** → select portfolio + contact + phone → **Launch Call**.

With `MOCK_MODE=true` the call agent dials `MOCK_CALL_TARGET` (your test phone) instead of Twilio.

---

## Directory Structure

```
talking-portfolio-risk/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # models: Portfolio, Contact, Consent,
│   │   │                        #   CallerProfile, OwnedNumber, DncEntry,
│   │   │                        #   Job, CallRecord (all with tenantId)
│   │   └── migrations/
│   └── src/
│       ├── config.ts            # env parsing + validation (Zod)
│       ├── db.ts                # Prisma client singleton
│       ├── server.ts            # Express app + WebSocket server
│       ├── seed.ts              # seeds default CallerProfile on first boot
│       ├── middleware/
│       │   └── tenant.ts        # x-tenant-id → req.tenantId (default: "default")
│       ├── routes/              # one file per API resource
│       ├── services/
│       │   ├── complianceDir.ts # writes/sha256s compliance bundle files
│       │   ├── jobRunner.ts     # job state machine
│       │   ├── optimizerClient.ts
│       │   ├── callAgentClient.ts
│       │   └── deliveryChannel.ts  # email (nodemailer/Mailpit)
│       ├── policies/
│       │   ├── types.ts         # RecipientPolicy interface
│       │   ├── selfCallPolicy.ts
│       │   ├── managedClientPolicy.ts  # Phase 7 stub
│       │   ├── registry.ts
│       │   └── checks/          # ownedNumbersGuard, dncCheck
│       ├── triggers/
│       │   └── noopEvaluator.ts # Phase 9 scaffold (EVENT_TRIGGERS_ENABLED=false)
│       └── ws/
│           └── jobSocket.ts     # per-job WebSocket relay (live transcript)
├── frontend/
│   └── src/
│       └── pages/               # Dashboard, Portfolios, Contacts,
│                                #   OwnedNumbers, CallerProfiles, RunKickoff,
│                                #   Compliance, Settings
├── optimizer/                   # FastAPI + Riskfolio-Lib (:8077)
│   ├── main.py
│   ├── server.py
│   ├── routers/                 # optimize, runs, export, talking, tickers
│   ├── services/                # data_fetcher, optimizer, pack_builder, pdf_generator
│   ├── ai/                      # analyzer + streaming router
│   ├── requirements.txt
│   └── venv/                    # gitignored — create with: python3 -m venv venv
├── optimizer-web/               # Optimizer standalone UI — React/Vite (:5181)
│   └── src/
│       ├── pages/               # Home, Upload, Configure, Results
│       ├── components/          # charts, tables, upload, configure, ui
│       ├── api/                 # typed client wrappers
│       └── store/               # Zustand stores
├── call-agent/                  # Gemini Live + Twilio voice (:3334)
│   ├── server.ts
│   ├── talking-dispatch.ts      # /api/talking-call/dispatch handler
│   ├── talking-prompt.ts        # grounded system prompt builder
│   ├── ai.ts                    # Gemini Live session
│   └── twilio.ts                # TwiML + media stream
├── scripts/
│   ├── dev.sh                   # start everything (ngrok + 5 services)
│   ├── dev-stop.sh              # kill everything
│   ├── dev-logs.sh              # tail a service log
│   └── dev-clear-compliance.sh  # remove dev compliance bundles
├── logs/                        # gitignored — truncated on each restart
├── .env.example
└── .env                         # gitignored — fill from .env.example
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Orchestrator + upstream service health |
| CRUD | `/api/portfolios` | Saved portfolios |
| CRUD | `/api/contacts` | Contacts with phone number list |
| POST | `/api/contacts/:id/consent` | Record/revoke consent (managed tier) |
| CRUD | `/api/caller-profiles` | Editable `{entity}` profiles |
| GET/POST | `/api/owned-numbers` | Manage allowlist |
| POST | `/api/owned-numbers/:id/confirm` | Manual ownership confirmation |
| GET/POST | `/api/dnc` | Do-not-call list |
| POST | `/api/jobs` | Kick off a call job |
| GET | `/api/jobs[/:id]` | List / inspect jobs |
| POST | `/api/jobs/:id/approve` | Maker-checker approval (stub; `APPROVAL_REQUIRED=false`) |
| GET | `/api/calls[/:id/transcript]` | Call records + transcript |
| POST | `/api/calls/webhook` | Webhook receiver from call agent |
| POST | `/api/calls/:id/deliver` | Delivery stub (records intent, sends nothing in P1) |
| GET | `/api/compliance/:job_id[/files/:name]` | Browse / download compliance bundle |
| WS | `/ws/jobs/:id` | Live status + transcript relay |

---

## Compliance Bundle

Every job writes a permanent bundle to `data/compliance/<job_id>/`:

```
report_pack.json    — exact data sent to the LLM (canonical grounding)
report.html         — human-readable render
report.pdf          — pulled from optimizer /api/export/pdf
admin_log.md        — config, gate decisions, outcome
transcript.txt      — only if recording consent satisfied
events.jsonl        — append-only audit (gate decisions, disclosures, deliveries)
manifest.json       — index: every file + sha256 + size + createdAt
```

These files are **never truncated** (distinct from `logs/` which are rewritten on restart).

---

## Policy Framework

The `RecipientPolicy` interface lets you swap compliance rules per contact without changing the call flow:

```
OWNED_NUMBERS_ONLY guard (unconditional, fail-closed)
    └── SelfCallPolicy       ← MVP: checks DNC only; consent/window auto-granted
    └── ManagedClientPolicy  ← Phase 7 stub: blocks on consent/window/frequency/identity
```

The guard runs before any policy. Any error in the guard → **block** (fail closed). Non-owned number → `not_owned_number` block, no dispatch.

---

## Compliance Note — Test Environment Gate Suppression

> **⚠ Non-Production Control: `MOCK_MODE=true`**

When `MOCK_MODE=true`, the pre-call compliance gate pipeline is **suppressed in its entirety**:

| Control | Production (`MOCK_MODE=false`) | Test (`MOCK_MODE=true`) |
|---|---|---|
| Owned-numbers guard | Enforced — fails closed | **Bypassed** |
| DNC check | Enforced | **Bypassed** |
| Consent verification | Enforced (ManagedClientPolicy) | **Bypassed** |
| Calling-window check | Enforced | **Bypassed** |
| Frequency cap | Enforced | **Bypassed** |
| Compliance bundle (pack/PDF/audit log/manifest) | Written | **Still written** |
| Audit event | `gate_evaluated` | `gate_skipped: mock_mode` |

This follows standard non-production practice in regulated financial systems: recipient-protection controls are designed for real end-users and must not block developer test runs against operator-owned numbers. The report generation and compliance bundle are preserved because those artifacts have audit value independent of the call path.

**Conditions required before disabling mock mode in any environment:**

- [ ] `OWNED_NUMBERS_ONLY=true` confirmed in environment config
- [ ] Phase 7 complete — `ManagedClientPolicy`, hosted consent form, and external counsel review
- [ ] DNC seeding and calling-window configuration verified end-to-end
- [ ] All test runs complete against owned numbers only

> **Do not set `MOCK_MODE=false` in any environment that can reach a real Twilio account until the above checklist is satisfied.** The mock flag is an environment boundary, not a feature toggle.

---

## Safety Rules

1. `OWNED_NUMBERS_ONLY=true` blocks every number not in the verified allowlist.
2. No call to a non-owned number until Phase 7 is built, tested, and counsel-reviewed.
3. Secrets live in env only — never in the DB, UI, or repository.
4. Compliance bundle files are permanent and never truncated.
5. The call agent persists no PII to disk — transcripts are written by the orchestrator only when recording consent is satisfied.
6. The voice agent answers only from the Report Context Pack (no invented figures).
7. Entity name, callback number, and disclaimers are always configurable via CallerProfile.

---

## Email / Delivery

Email uses **nodemailer** over plain SMTP so the provider is swappable by config. In dev, **[Mailpit](https://mailpit.axllent.org/)** captures messages locally (web UI `:8025`, SMTP `:1025`, $0, nothing leaves the machine). For real sends, aim the same SMTP env at any free-tier provider (Brevo, MailerSend, Resend) — no code change needed.

Phase 1: the `POST /api/calls/:id/deliver` endpoint records delivery intent in `events.jsonl` and returns `queued_stub` — nothing is sent yet.

---

## Feature Flags

All default to `false` / off for MVP:

| Flag | Description |
|---|---|
| `APPROVAL_REQUIRED` | P8 — halt job at `pending_approval` until `/api/jobs/:id/approve` |
| `EVENT_TRIGGERS_ENABLED` | P9 — event-driven auto-kickoff |
| `INBOUND_ENABLED` | P10 — Twilio inbound webhook + TwiML bridge |

---

## DISCLAIMER

This software is for educational and personal use only. It places AI-generated voice calls and discusses financial optimization output. It does not constitute financial advice. Before calling anyone other than yourself, confirm current telephony, AI-disclosure, recording-consent, and financial-communication requirements in your jurisdiction with qualified counsel, and complete Phase 7 (ManagedClientPolicy + consent form + counsel review).
