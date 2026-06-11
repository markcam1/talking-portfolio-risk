# CLAUDE.md — Talking Portfolio

Operating guide for the coding agent working in the **`talking-portfolio`** repo. Full detail lives in `talking-portfolio-spec.md` (read it first). This file is the short, always-applies version.

## What this is
An orchestrator + web control panel that runs the Portfolio Optimizer on a saved portfolio, then has an AI voice agent **call the operator's own phone** to discuss the result. MVP is **self-call only**. The compliance layer is a pluggable `RecipientPolicy`; a future "consenting clients" tier drops in without touching the call flow.

## Monorepo layout — everything lives here
| Directory | Role | Port |
|---|---|---|
| `backend/` | Orchestrator — Express, Prisma, policy framework, compliance bundle | :5179 |
| `frontend/` | Web control panel — React | :5180 |
| `optimizer/` | Portfolio Optimizer — FastAPI + Riskfolio-Lib | :8077 |
| `optimizer-web/` | Optimizer standalone UI — React/Vite | :5181 |
| `call-agent/` | Voice call agent — Node/TS + Twilio + Gemini Live | :3334 |

The sibling repos at `/home/master/Software/portfolio_mngt/cc_riskfolio/portfolio-optimizer` and `/home/master/Software/openclaw/voicecall-app` were the originals; the co-located versions above are the ones `dev.sh` actually runs.

**Reuse existing secrets** (Twilio, Gemini, Brave) — copy from those repos' `.env` files. Never regenerate keys. If a key is missing, say so — don't invent one. Email is **not** Mailchimp: send over SMTP (nodemailer); dev uses **Mailpit** (free, local, $0).

## Hard rules (do not violate)
1. **Owned-numbers guard is the safety boundary.** While `OWNED_NUMBERS_ONLY=true`, never dial a number that isn't operator-verified. The guard runs before any policy and **fails closed** (any error → block).
2. **No real call to a non-owned number until Phase 7** (ManagedClientPolicy) is built, tested, and counsel-reviewed.
3. **Never commit secrets.** Env only. Honor OpenClaw `SecretRef`.
4. **Never truncate the compliance bundle** (`DATA_DIR/compliance/<job_id>/`) — including any `.eml` email archives. Only the dev process logs in `logs/` are truncated on restart.
5. **The call agent must not persist PII to disk.** Transcripts are persisted by the orchestrator, and only when recording consent is satisfied.
6. **Grounding:** the voice agent answers only from the Report Context Pack. No invented numbers. Educational commentary, never investment advice.
7. **Entity is configurable** (CallerProfile) — never hardcode entity name, callback number, or disclaimers.

## Dev loop — one command, no terminal juggling
- `scripts/dev.sh` starts **everything in the background**: ngrok → auto-writes the public URL into `call-agent/.env` as `PUBLIC_URL` → optimizer (:8077), call-agent (:3334), orchestrator (:5179), web UI (:5180), optimizer-web (:5181). Each service logs to `logs/<svc>.log` (rewritten each restart). PIDs go to `.dev/pids`.
- `scripts/dev-stop.sh` kills everything (PIDs + ngrok). `scripts/dev-logs.sh [svc]` tails a log.
- `scripts/dev-clear-compliance.sh [job_id]` removes compliance bundles from `backend/data/compliance/` — all bundles, or one by job ID.
- The ngrok auto-wire (poll `http://127.0.0.1:4040/api/tunnels`, sed `PUBLIC_URL`, then boot the backend) removes the manual step every restart. A **static ngrok domain** makes this a no-op — prefer it.
- Keep `MOCK_MODE=true` and `MOCK_CALL_TARGET` pointed at the operator's phone for all self-call testing.

## Multi-tenancy
All API routes pass through `backend/src/middleware/tenant.ts`, which reads the `x-tenant-id` request header and sets `req.tenantId` (defaults to `"default"`). The Prisma schema includes a `tenantId` column on every resource. Single-tenant deployments just omit the header.

## Build order
~~P1 optimizer hooks~~ ✅ → ~~P2 orchestrator core + registries + compliance dir + PDF archival~~ ✅ → ~~P3 policy framework + SelfCallPolicy + owned-numbers guard + audit~~ ✅ → ~~P4 call agent: `/api/talking-call/dispatch`, grounded prompt, disclosures, voicemail, transcript, opt-out~~ ✅ = **MVP complete** → **P5 news lookup** → P6 constrained rerun + `send_report` → P7 ManagedClientPolicy + hosted consent form (then consider enabling non-owned calls) → P8 maker-checker approval → P9 event-driven triggers → P10 inbound calls.

**Scaffold P8–P10 inertly during MVP** (see spec §6.5): the `pending_approval` state + `/api/jobs/:id/approve`, the `event` trigger interface + `noop` evaluator, and the inbound Twilio webhook/TwiML route — all behind flags (`APPROVAL_REQUIRED`, `EVENT_TRIGGERS_ENABLED`, `INBOUND_ENABLED`) defaulting **off**, so they don't affect MVP behavior.

## Definition of done for MVP
See spec §14. In short: self-call works end-to-end in mock mode; compliance bundle (pack JSON + HTML + PDF + admin log + manifest w/ sha256) is written; owned-numbers guard blocks non-owned and fails closed; a stub ManagedClientPolicy proves each gate blocks; opt-out → DNC; voicemail is limited; `{entity}` flows from the web app into prompt/disclosures/voicemail; `dev.sh` brings the stack up in the background; optimizer offline behavior unchanged when `OPTIMIZER_HEADLESS` unset.

## Style
Match each service's existing stack and conventions. Prefer small, additive changes to the service directories; put new regulated logic in `backend/`. Ask before introducing a new heavy dependency.
