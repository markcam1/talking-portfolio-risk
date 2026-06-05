# Talking Portfolio — Implementation Plan

## Context

The `talking-portfolio-risk` repo is a greenfield project (spec + CLAUDE.md only, zero source code). This plan implements the MVP (Phases 1–4): run the Portfolio Optimizer on a saved portfolio, then have a Gemini Live voice agent call the operator's own phone to discuss the result. The compliance layer is built as an extensible `RecipientPolicy` framework. Phases 8–10 are scaffolded inertly in this same pass.

---

## Current State of the Three Repos

| Repo | What Exists | What's Needed |
|---|---|---|
| `portfolio-optimizer` | ✅ P1 done: headless mode guard, `/api/talking/run`, `/api/talking/pack`, `services/pack_builder.py`, Electron button; plus original `/api/optimize`, `/api/runs`, `/api/export/pdf` | — |
| `voicecall-app` | Express + Gemini Live; `/api/call`, `MOCK_MODE`, Twilio flow; system prompt built from `PROMPT_GEM_TEMP.md` | **P4:** `POST /api/talking-call/dispatch`, grounded prompt in `ai.ts`, transcript webhook relay, opt-out handler |
| `talking-portfolio-risk` | ✅ P2 done: full backend + frontend scaffold (see Phase 2 details below) | **P3:** wire owned-numbers guard + SelfCallPolicy into jobRunner (already stubbed); **P4:** call agent dispatch endpoint |

---

## Phase 1 — Optimizer Additions ✅ DONE

**Files created/modified in `portfolio-optimizer/backend/`:** `routers/talking.py`, `services/pack_builder.py`, headless mode env guard in `main.py`, Electron button in renderer pages.

---

## Phase 1 detail — Optimizer Additions (Python, additive)

**Files to create/modify in `portfolio-optimizer/backend/`:**

1. **Headless mode guard** — `main.py` (or a new `scripts/run-headless.sh`):
   - Read `OPTIMIZER_HEADLESS` env var; if set, bind uvicorn to `127.0.0.1:OPTIMIZER_HEADLESS_PORT` (default `8077`) and skip Electron IPC.
   - `APP_DATA_PATH` falls back to `~/.config/Portfolio Optimizer/` when Electron is absent (run_store.py already has a `../dev-data/` fallback — wire to env override).
   - Add `scripts/run-headless.sh`: `OPTIMIZER_HEADLESS=1 OPTIMIZER_HEADLESS_PORT=8077 python -m uvicorn main:app --host 127.0.0.1 --port 8077`

2. **`POST /api/talking/run`** — new router `routers/talking.py`:
   - Body: `{ mode: "last" | "saved" | "config", run_id?: str, config?: {...} }`
   - `mode=last`: load the most-recent run from `list_runs()[0]`; skip re-optimization if recent enough, else trigger optimize
   - `mode=saved`: load `run_id`; verify exists
   - `mode=config`: accept full `OptimizeRequest`-compatible body, run optimization, save, trigger Ollama analysis
   - Returns `{ run_id: str }`

3. **`GET /api/talking/pack/{run_id}`** — add to `routers/talking.py`:
   - Build pack via `services/pack_builder.py` (new file)
   - Optional `?format=json|markdown|html` (default `json`)
   - Returns Section 5.1 JSON structure

4. **`services/pack_builder.py`** (new):
   ```python
   def build_pack(run: OptimizationResult) -> dict:
       # Maps OptimizationResult → Report Context Pack schema (spec §5.1)
       # Computes objective_plain, top_holdings, sharpe_ratio, etc.
       # Pulls ai_commentary + ai_commentary_model from run
   ```
   Objective plain-English mapping: `{"Sharpe": "Maximize risk-adjusted return (Sharpe)", "MinRisk": "Minimize portfolio risk", ...}`

5. **Electron button** — `src/renderer/src/pages/` (or existing home page):
   - Add "Talking Portfolio" button → `window.electron.openExternal(TALKING_PORTFOLIO_URL)` (default `http://localhost:5180`)
   - Read `TALKING_PORTFOLIO_URL` from env via IPC or hardcode default
   - Add a short info page/modal explaining what it does

---

## Phase 2 — Talking-Portfolio Orchestrator Setup ✅ DONE

**Files created in `talking-portfolio-risk/`:**
- `backend/prisma/schema.prisma` — 8 models; initial migration applied, DB seeded with default CallerProfile
- `backend/src/config.ts`, `db.ts`, `server.ts`, `seed.ts`
- Routes: `portfolios`, `contacts`, `callerProfiles`, `ownedNumbers`, `dnc`, `jobs` (+ P8 approve stub), `calls` (+ webhook + delivery stub), `compliance`, `health`
- Services: `complianceDir` (sha256 manifest), `optimizerClient`, `callAgentClient`, `jobRunner` (full state machine), `deliveryChannel` (stub)
- Policies: `types.ts`, `selfCallPolicy.ts`, `managedClientPolicy.ts` (P7 stub), `registry.ts`, `checks/ownedNumbersGuard.ts`, `checks/dncCheck.ts`
- `triggers/noopEvaluator.ts` (P9 scaffold), `ws/jobSocket.ts`
- Frontend: React 18 + Vite + Tailwind; 8 pages (Dashboard, Portfolios, Contacts, OwnedNumbers, CallerProfiles, RunKickoff, Compliance, Settings)
- `scripts/dev.sh`, `dev-stop.sh`, `dev-logs.sh`
- `.env`, `.env.example`, `.gitignore`

---

## Phase 2 detail — Talking-Portfolio Orchestrator Setup (new repo)

**Stack:** Node 22 + TypeScript, Express, Prisma + SQLite, React 18 + Vite + Tailwind.

### 2a. Project scaffold

```
talking-portfolio-risk/          # /home/master/Software/portfolio_mngt/talking_portfolio_risk
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express app, route registration
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── config.ts          # env parsing + validation
│   │   ├── routes/            # one file per resource
│   │   │   ├── portfolios.ts
│   │   │   ├── contacts.ts
│   │   │   ├── callerProfiles.ts
│   │   │   ├── ownedNumbers.ts
│   │   │   ├── jobs.ts
│   │   │   ├── calls.ts
│   │   │   ├── compliance.ts
│   │   │   ├── dnc.ts
│   │   │   └── health.ts
│   │   ├── services/
│   │   │   ├── optimizerClient.ts    # HTTP client to :8077
│   │   │   ├── callAgentClient.ts    # HTTP client to :3334
│   │   │   ├── complianceDir.ts      # writes/reads compliance/<job_id>/
│   │   │   ├── jobRunner.ts          # job state machine
│   │   │   └── deliveryChannel.ts   # stub email/SMS
│   │   ├── policies/
│   │   │   ├── types.ts              # RecipientPolicy interface
│   │   │   ├── registry.ts
│   │   │   ├── selfCallPolicy.ts
│   │   │   ├── managedClientPolicy.ts  # stub
│   │   │   └── checks/
│   │   │       ├── ownedNumbersGuard.ts
│   │   │       ├── dncCheck.ts
│   │   │       ├── consentCheck.ts
│   │   │       └── callingWindowCheck.ts
│   │   ├── triggers/
│   │   │   └── noopEvaluator.ts    # Phase 9 scaffold
│   │   └── ws/
│   │       └── jobSocket.ts        # WebSocket relay for live transcript
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Portfolios.tsx
│   │   │   ├── Contacts.tsx
│   │   │   ├── OwnedNumbers.tsx
│   │   │   ├── CallerProfiles.tsx
│   │   │   ├── RunKickoff.tsx
│   │   │   ├── Compliance.tsx
│   │   │   └── Settings.tsx
│   │   ├── api/               # fetch wrappers
│   │   ├── store/             # Zustand
│   │   └── App.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── scripts/
│   ├── dev.sh
│   ├── dev-stop.sh
│   └── dev-logs.sh
├── data/                      # gitignored; compliance/<job_id>/ lives here
├── logs/                      # gitignored; dev process logs (truncated each restart)
├── .dev/                      # gitignored; PIDs
├── .env.example
└── .env                       # gitignored
```

### 2b. Prisma schema models

- `Portfolio` — id, name, tickers (JSON), config (JSON), dateRange (JSON), optimizerRunRef, timestamps
- `Contact` — id, name, phoneNumbers (JSON array), timezone, policyId, timestamps
- `Consent` — id, contactId, status, method, scope, grantedAt, expiresAt, evidenceUri, recordingConsent
- `CallerProfile` — id, entityName, callbackNumber, voicePersona, financialDisclaimer, isDefault
- `OwnedNumber` — id, phoneE164, label, verified, verificationMethod, verifiedAt, addedBy
- `DncEntry` — id, phoneE164, addedAt, source, note
- `Job` — id, savedPortfolioId, contactId, phoneE164, callerProfileId, trigger, status, blockReason, policyId, packId, complianceDir, timestamps
- `CallRecord` — id, jobId, provider, providerCallSid, startedAt, endedAt, outcome, modeChosen, recordingConsented, transcriptUri, disclosuresDelivered (JSON)

### 2c. Config (config.ts)

Parse from `.env`:
- `PORT`, `WEB_PORT`, `OPTIMIZER_BASE_URL`, `CALL_AGENT_BASE_URL`, `DB_PATH`, `DATA_DIR`, `LOG_DIR`
- `OWNED_NUMBERS_ONLY=true`, `DEFAULT_POLICY_ID=self`, `SELF_CALL_IGNORE_WINDOW=true`
- `CALLING_WINDOW_START/END`, `FREQUENCY_CAP_PER_DAY`, `MOCK_MODE`
- SMTP vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `COMPLIANCE_BCC`
- Feature flags (all false): `APPROVAL_REQUIRED`, `EVENT_TRIGGERS_ENABLED`, `INBOUND_ENABLED`
- Seed: `DEFAULT_ENTITY_NAME`, `DEFAULT_CALLBACK_NUMBER`

---

## Phase 3 — Policy Framework + Compliance + Guard

### Policy interface (`policies/types.ts`)

```typescript
interface RecipientPolicy {
  id: "self" | "managed_client" | "open";
  evaluate(ctx: CallContext): Promise<GateResult>;
  buildDisclosures(ctx: CallContext): Disclosures;
  onOptOut(ctx: CallContext): Promise<void>;
}
interface GateResult {
  allow: boolean; reason?: string;
  disclosures: Disclosures; requireRecordingConsent: boolean;
}
```

### Owned-numbers guard (`checks/ownedNumbersGuard.ts`)

- **Runs before any policy**; wraps in try/catch; any error → block `not_owned_number`
- Queries `OwnedNumber` table: `WHERE phoneE164 = ? AND verified = true`
- Returns `{ blocked: true, reason: "not_owned_number" }` if not found

### `SelfCallPolicy` (`policies/selfCallPolicy.ts`)

Checks run in order:
1. `ownedNumbersGuard` (already ran — confirmed owned)
2. `dncCheck` — check `DncEntry` table
3. Skip: calling window, frequency cap, identity, consent (auto-granted)
4. `recordingConsent` = auto-granted (single-party)
5. `buildDisclosures` from selected `CallerProfile`

### Compliance directory (`services/complianceDir.ts`)

- `initDir(jobId)` — creates `DATA_DIR/compliance/<jobId>/`
- `writeFile(jobId, name, content)` — writes file, computes sha256, updates manifest
- `appendEvent(jobId, event)` — appends to `events.jsonl`
- `buildManifest(jobId)` — writes/updates `manifest.json` with `{ files: [{ name, sha256, size, createdAt }] }`
- **Never truncate compliance files** — only overwrite manifest (additive entries)

### Job state machine (`services/jobRunner.ts`)

State transitions persisted to both `Job.status` (DB) and `events.jsonl`:
```
queued → optimizing → [pending_approval if APPROVAL_REQUIRED] → gated → dialing → in_call → {completed|voicemail|blocked|failed}
```

Runner steps:
1. Set `optimizing` → call optimizer `/api/talking/run` → `/api/talking/pack` → `/api/export/pdf`
2. Write `report_pack.json`, `report.html`, `report.pdf`, `admin_log.md` to compliance dir
3. `ownedNumbersGuard` → policy `evaluate()` → if blocked: write block to events.jsonl, set `blocked`
4. If `APPROVAL_REQUIRED`: set `pending_approval`, halt; resume on `POST /api/jobs/:id/approve`
5. Set `gated` → `dialing` → dispatch to call agent
6. On call agent result: set `in_call` / `voicemail` / `completed` / `failed`
7. On completed: pull transcript (if recording consented), write `transcript.txt`, finalize manifest

---

## Phase 4 — Call Agent Additions + Web UI

### Call agent modifications (`voicecall-app/backend/`)

**New file: `talking-dispatch.ts`** (or extend `server.ts`):

`POST /api/talking-call/dispatch`:
```typescript
// Body: { call_id, phone_e164, report_pack, mode_hint, disclosures, voicemail_script, status_webhook }
// 1. Build grounded system prompt (ai.ts or new buildGroundedPrompt())
// 2. Store in callContexts map keyed by a generated SID
// 3. Initiate Twilio call (or mock) to phone_e164
// 4. Return { accepted: true, provider_call_sid }
```

**`ai.ts` — `buildGroundedPrompt(pack, disclosures, modeHint)`**:
- Replace current template-based approach for this flow
- System prompt structure from spec §8 — injects `{entity_name}`, `{callback_number}`, `{financial_disclaimer}`, full `report_pack` JSON
- HARD RULES: answer only from pack, no invented numbers, not investment advice, opt-out handling
- Flow instructions: disclosures → recording consent (if required) → summary/detail → Q&A

**Transcript webhook to orchestrator**:
- On each transcript chunk: `POST status_webhook` with `{ event: "transcript", call_id, role, text }`
- On call end: `POST status_webhook` with `{ event: "status", call_id, outcome, mode_chosen }`

**Opt-out detection** in conversation flow:
- Configurable phrases ("stop", "remove me", "unsubscribe")
- On detection: confirm verbally, end call, `POST status_webhook { event: "opt_out", call_id }`

**Voicemail handling** (existing `machineDetection: 'Enable'`):
- On AMD `machine_start`: speak `voicemail_script` (supplied by orchestrator), hang up
- Outcome: `voicemail`

### Inbound call stub (`INBOUND_ENABLED=false`)

In `server.ts`, add behind flag:
```typescript
if (config.INBOUND_ENABLED) {
  app.post('/incoming', (req, res) => { /* TwiML <Connect><Stream> reusing /stream WS */ });
}
```

### Orchestrator webhook handler (`backend/src/routes/calls.ts`)

- `POST /api/calls/webhook` — receives events from call agent
- On `transcript`: append to in-memory buffer; relay via WS to connected UI clients
- On `opt_out`: add to DNC, update job status
- On `status` with terminal outcome: write transcript.txt (if consented), update CallRecord, finalize manifest

### Web UI pages

- **Dashboard** — job table (status badges), quick-start button, health panel (optimizer/call-agent connectivity)
- **Portfolios** — CRUD (name, tickers, config, date range); "Run Talking Portfolio" button per row
- **Contacts** — CRUD with phone number list, policy_id selector
- **Owned Numbers** — Add number + manual-confirm button ("I confirm I own this number") → sets `verified=true, verifiedAt=now`; shows verified badge
- **Caller Profiles** — Edit entity_name, callback_number, disclaimer, voice_persona; set default
- **Run/Kickoff** — Select portfolio + contact + phone + profile + mode_hint; launch button; live status feed + transcript relay via WebSocket; gate-blocked reason shown (no bypass)
- **Compliance** — Browse `compliance/<job_id>/` files; view/download; manifest delivery status
- **Settings** — Endpoints, mock toggle, calling window, frequency cap (secrets never in UI)

---

## Phase P8–P10 Inert Scaffolding (built during MVP, flags off)

### P8 — Maker-checker (`APPROVAL_REQUIRED=false`)
- `pending_approval` state exists in Job status enum
- `POST /api/jobs/:id/approve` exists but no-ops unless flag is true
- UI shows an "Approve" button on jobs in `pending_approval` state

### P9 — Event triggers (`EVENT_TRIGGERS_ENABLED=false`)
- `triggers/` directory with `EventTrigger` interface and `NoopEvaluator` class
- `Job.trigger` enum includes `event`
- No-op evaluator always returns `{ shouldFire: false }`

### P10 — Inbound (`INBOUND_ENABLED=false`)
- `POST /incoming` in call agent returns TwiML pointing at `/stream` WebSocket
- `resolveInboundCaller(fromNumber)` stub returns `null`
- Route is registered only when `INBOUND_ENABLED=true`

---

## Dev Scripts (`scripts/`)

### `dev.sh`
1. Start ngrok: `ngrok http 3334 &` → wait for pid
2. Poll `http://127.0.0.1:4040/api/tunnels` → extract `https` public_url
3. `sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=${public_url}|" /path/to/voicecall-app/backend/.env`
4. Launch (each `>` truncates log on restart):
   ```bash
   nohup scripts/start-optimizer.sh > logs/optimizer.log 2>&1 & echo $! >> .dev/pids
   nohup node dist/server.js        > logs/orchestrator.log 2>&1 & echo $! >> .dev/pids
   nohup npx vite --port 5180       > logs/web.log 2>&1 & echo $! >> .dev/pids
   # call agent (in voicecall-app/backend/):
   nohup npx ts-node server.ts      > logs/callagent.log 2>&1 & echo $! >> .dev/pids
   ```
5. Health-check each port, print URLs

### `dev-stop.sh`
- Kill all PIDs in `.dev/pids`; kill ngrok by process name

### `dev-logs.sh [svc]`
- `tail -f logs/<svc>.log`

---

## Technical Decisions (from spec options)

| Decision | Choice | Reason |
|---|---|---|
| Web framework | Express | Consistency with call agent codebase |
| ORM | Prisma | Type safety, migration support, listed first in spec |
| Email (dev) | Mailpit (`:1025`/`:8025`) | Free, local, zero config, spec-mandated |
| Email (prod) | nodemailer SMTP, config-swappable | No code change to switch providers |
| Headless startup | `run-headless.sh` script | Simpler than env detection inside Electron |

---

## Key Files to Reuse (do not reimplement)

- `portfolio-optimizer/backend/services/run_store.py` — `load_run()`, `list_runs()`
- `portfolio-optimizer/backend/routers/export.py` — `/api/export/pdf` (call it, don't copy it)
- `portfolio-optimizer/backend/ai/analyzer.py` — `stream_analysis()` (trigger Ollama on new run)
- `voicecall-app/backend/server.ts` — all Twilio/Gemini/WebSocket infrastructure; add dispatch endpoint, don't rewrite
- `voicecall-app/backend/.env` — reuse `TWILIO_*`, `GEMINI_API_KEY`, `BRAVE_API_KEY`

---

## Verification (end-to-end)

1. `scripts/dev.sh` — all 4 services start, URLs printed, no errors in any `.log`
2. Web UI → Owned Numbers → add operator's phone → manual confirm → verified badge shown
3. Web UI → Portfolios → select/create → Run Kickoff → launch
4. Compliance dir written: `report_pack.json`, `report.html`, `report.pdf`, `admin_log.md`, `manifest.json` all present with sha256
5. `MOCK_MODE=true` → mock call placed → disclosures heard → summary/detail offered → Q&A grounded to pack
6. Ask an out-of-pack question → agent declines, no fabrication
7. Add a non-owned number → attempt job → `not_owned_number` block, no dispatch
8. Say "unsubscribe" → call ends → DNC entry created → next job with same number blocked
9. Edit entity name in Caller Profiles → re-run → new entity name heard in disclosures
10. Transcript appears in UI live; `transcript.txt` written in compliance dir
11. Turn optimizer off → `dev.sh` starts without it → existing Electron usage unaffected (no `OPTIMIZER_HEADLESS` set)
