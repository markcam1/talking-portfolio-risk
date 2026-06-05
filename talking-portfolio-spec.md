# Talking Portfolio — Development Specification

**Audience:** an autonomous coding agent (e.g. Claude Code) executing against three repositories.
**Author intent:** enhance the Portfolio Optimizer so it can phone a contact and discuss their optimized portfolio in a live voice conversation, reusing the live-call machinery already built in the Autonomous Call Agent.
**MVP scope:** **self-call only** — the system only dials phone numbers the operator owns and has confirmed (an allowlist). The full consent/compliance machinery is built as a **pluggable policy framework** so a later "consenting clients I manage" tier drops in without reworking the call flow.
**Status:** v1 spec. Build MVP (Phases 1–4) with `SelfCallPolicy`; framework designed so `ManagedClientPolicy` (Phase 7) is additive.

> **Read this first.** Not legal or financial advice. Even in self-call MVP the system places AI-voice calls and discusses financial data. Self-call keeps exposure minimal (you call/record yourself). The "who can be called" decision lives in one swappable place (Section 7) and must be reviewed by counsel before calling anyone else. See the companion **CLAUDE.md** for the dev workflow and operating rules.

---

## 0. For the coding agent: source code & secrets

Pull existing code and **reuse existing `.env` keys** from the operator's Linux machine — do **not** regenerate Twilio/Gemini/Brave/Mailchimp credentials:

| Component | Local path | Notes |
|---|---|---|
| Portfolio Optimizer | `/home/master/Software/portfolio_mngt/cc_riskfolio/portfolio-optimizer` | Electron + FastAPI; has `/api/export/pdf` already |
| Call agent backend | `/home/master/Software/openclaw/voicecall-app/backend` | locally named **voicecall-app** (OpenClaw ecosystem); this is the `autonomous-call-agent` code |
| Mailchimp pattern (reference) | `rsu_vitals` repo → `integrations/mailchimp.py` | reuse the subscriber-upsert pattern + `MAILCHIMP_API_KEY/LIST_ID/SERVER_PREFIX` |

Rules: read the existing `.env`/secrets to populate the new orchestrator's config; **never commit secrets**; keep secrets in env only (honor the call agent's `SecretRef`/OpenClaw conventions). If a key is missing, surface it — don't invent one.

---

## 1. Goals

On a manual or scheduled trigger:

1. Run the optimizer on a **saved or last-used portfolio**.
2. Produce a **Report Context Pack** (machine-ready, sent to the LLM) **plus** a human-readable **admin log** and a **PDF** of the run, all written to a per-job **compliance directory**.
3. Place a live call to a **saved contact's number** (gated by the active `RecipientPolicy`).
4. Let the contact choose a **summary** or **detailed** walkthrough, then ask **follow-up questions**, answered live and grounded strictly in the report.
5. Leave a short, limited voicemail if unanswered.
6. Write a human-readable transcript (when the policy's recording-consent check allows).

**MVP constraint:** only `SelfCallPolicy` is enabled, and an unconditional **owned-numbers guard** refuses to dial any number not on the operator's confirmed allowlist (Section 7.2). This is both the product scope and the test harness (pairs with the call agent's `MOCK_CALL_TARGET`).

**Future:** `ManagedClientPolicy` (consenting clients), event-driven triggers, email/SMS delivery of compliance files, news lookup, and constrained re-runs. See Section 18.

### Non-goals (v1)
- No financial advice — descriptive commentary on the optimizer's output only.
- No calls to numbers off the owned-numbers allowlist, regardless of policy.
- No actual email/SMS sending in Phase 1 (stub the delivery action; the voicemail merely *says* an email will follow).
- No change to the optimizer's offline-first guarantee for normal desktop use.

---

## 2. Existing systems (ground truth)

### 2.1 `portfolio-optimizer`
- Electron 41 shell; React 18 + Vite + Tailwind (Zustand, React Query, Recharts) frontend.
- **FastAPI + Uvicorn** backend, spawned by Electron on a dynamic localhost port. Fully offline today.
- Riskfolio-Lib 7.x (24 risk measures; objectives Max Sharpe / Min Risk / Max Return / Max Utility); yfinance data.
- Local **Ollama** streaming commentary (`backend/config.yaml` model list + picker), saved with the run and embedded in the PDF.
- Every run saved as JSON in app-data (Linux `~/.config/Portfolio Optimizer/runs/`); `logs/` subfolder.
- **PDF export already exists:** `/api/export/pdf` (reportlab + matplotlib: metrics, allocation pie, weights, risk-contribution chart, AI analysis).
- Backend: `main.py`, `config.yaml`, `routers/` (`/api/optimize`, `/api/validate-tickers`, `/api/runs`, `/api/export/pdf`), `services/` (`optimizer.py`, `data_fetcher.py`, `run_store.py`), `ai/` (`analyzer.py`, `router.py`), `models/`, `utils/`. Frontend: `src/main/`, `src/preload/`, `src/renderer/src/` (`pages/`, `ai/`, `store/`, `api/`, `components/`, `utils/`).

### 2.2 `autonomous-call-agent` (local: `voicecall-app`)
- React + Vite frontend (`:5173`); Node.js + TypeScript backend (Express + WebSocket).
- Twilio Media Streams; ngrok for webhooks; bidirectional µ-law/PCM transcoding; native barge-in.
- **Gemini 3.1 Flash Multimodal Live API** = conversational brain; live transcripts.
- Ollama (`llama3.1:8b-instruct-q8_0`) for post-call briefings; Brave Search for discovery.
- `MOCK_MODE` + `MOCK_CALL_TARGET` for safe testing. **Stores no call logs today** (we add transcripts, gated by recording consent).
- Files: `backend/server.ts`, `backend/task-agent.ts`, `backend/ai.ts`; `frontend/src/App.tsx`.
- Env: `TWILIO_*`, `GEMINI_API_KEY`, `BRAVE_API_KEY`, `MOCK_MODE`, `MOCK_CALL_TARGET`, `PORT`, `PUBLIC_URL`.

> Implication: live voice, transcoding, barge-in, mock mode, Brave, and Ollama all exist. The new work is grounding the agent in a specific report, plus consent/transcript/compliance handling. The optimizer already produces the PDF we want to archive.

---

## 3. Target architecture

### 3.1 Repos & responsibilities

| Repo | Role | Change size |
|---|---|---|
| **`talking-portfolio`** (NEW) | Orchestrator + web control panel. Owns kickoff (manual/cron), registries (portfolios, contacts, caller profiles, owned-numbers, consent, DNC), the **RecipientPolicy framework**, pack building, PDF archival, compliance directory, call dispatch, transcripts/admin logs, delivery stubs. | New repo |
| `portfolio-optimizer` | Add headless mode + `/api/talking/run` + `/api/talking/pack`; reuse existing `/api/export/pdf`. Add an Electron "Talking Portfolio" button + info page. | Small, additive |
| `autonomous-call-agent` | Accept an injected Report Context Pack, build a grounded Gemini Live prompt, support summary/detail flow, deliver policy-supplied disclosures, handle opt-out, emit a transcript, expose stubbed delivery/tool hooks. | Medium, additive |

### 3.2 Stack for the new repo
Node 22 + TypeScript (Fastify/Express); React 18 + Vite + Tailwind web UI; SQLite (Prisma or better-sqlite3) for structured data; on-disk **compliance directory** for file artifacts. Talks HTTP to both backends; no shared DB.

### 3.3 Component diagram (prose)
```
                 ┌─────────────────────────────────────────────┐
 manual / cron → │              talking-portfolio              │
 (or event)      │  Web UI (React)  ──►  Orchestrator (Node)   │
                 │   RecipientPolicy ◄──┐    │      │           │
                 │   (SelfCallPolicy)   │    │      └─► compliance/<job_id>/ (pdf, json, html,
                 │   CallerProfile {entity}  │            admin_log, transcript, manifest, events)
                 └───────────────────────────┼──────────────────┘
                            (HTTP)            │ (HTTP)
              ┌─────────────────────┐         │        ┌──────────────────────────┐
              │ portfolio-optimizer │ ◄───────┘───────► │  autonomous-call-agent   │
              │ headless FastAPI    │ run + pack + pdf   │ Gemini Live + Twilio      │
              └─────────────────────┘                    └──────────┬───────────────┘
                                                          Your own (allowlisted) phone
```

---

## 4. End-to-end workflow

1. **Kickoff** — manual (web/Electron button), cron, or (future) event trigger → `Job{savedPortfolioId, contactId, phone_e164, caller_profile_id, mode_hint}`.
2. **Optimize & archive** — orchestrator calls optimizer headless to run on the saved/last portfolio, then pulls: the **Report Context Pack** (`/api/talking/pack`), the **PDF** (`/api/export/pdf`), and renders an **admin log**. All written to `compliance/<job_id>/` with a `manifest.json`.
3. **Gate** — owned-numbers guard (unconditional) → `policy.evaluate()`. Fail → `blocked{reason}`, no call.
4. **Dispatch** — send pack + number + grounded prompt + policy-resolved disclosures (built from the chosen **CallerProfile**) to the call agent.
5. **Answered** — agent delivers disclosures, asks recording consent if required, then: *"Quick summary or detailed walkthrough?"* → answers grounded Q&A.
6. **Q&A** — strictly from the pack; out-of-scope → declines; verbal opt-out honored anytime.
7. **Voicemail (unanswered)** — **limited**: state the optimization objective at a high level and that *"a detailed report from {entity} has been prepared and an email will follow."* No holdings, weights, or figures. (Email is **stubbed** in Phase 1 — not sent; the voicemail line is still spoken.) Outcome `voicemail`.
8. **Logging** — outcome always; full transcript only if recording consent satisfied. Update job + manifest.
9. **(Future)** — `lookup_news(ticker)`, constrained `rerun_optimizer(...)`, and `send_report(channel)` delivering a compliance-dir file by email/SMS.

---

## 5. Data contracts

### 5.1 Report Context Pack (data file sent to the LLM)
Canonical **JSON** (also rendered to markdown/text/html for logs/voicemail). Single grounding object; keep < ~8 KB.
```jsonc
{
  "schema_version":"1.0","pack_id":"uuid","generated_at":"ISO-8601",
  "portfolio":{"name":"string","tickers":["AAPL","..."],"date_range":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}},
  "config":{"risk_measure":"MV|CVaR|MDD|...","objective":"MaxSharpe|MinRisk|MaxReturn|MaxUtility",
            "risk_free_rate":0.045,"risk_aversion":null,"alpha":null,"method_mu":"string","method_cov":"string"},
  "headline":{"objective_plain":"Maximize risk-adjusted return (Sharpe)","sharpe_ratio":1.23,
              "expected_return_annual":0.142,"portfolio_risk_annual":0.115,
              "top_holdings":[{"ticker":"AAPL","weight":0.22}]},
  "weights":[{"ticker":"AAPL","weight":0.22}],
  "risk_contribution":[{"ticker":"AAPL","contribution":0.27}],
  "ai_commentary":"string (optimizer's Ollama commentary)","ai_commentary_model":"llama3.1:8b-instruct-q8_0",
  "source_run_id":"optimizer run id","disclaimers":["Educational use only. Not investment advice."]
}
```

### 5.2 Saved Portfolio
```jsonc
{ "id":"uuid","name":"string","tickers":["..."],"config":{ /* 5.1.config */ },
  "date_range":{"start":"","end":""},"optimizer_saved_run_ref":"optional run id",
  "created_at":"","updated_at":"" }
```

### 5.3 Caller Profile (the configurable `{entity}` — editable in the web app)
```jsonc
{ "id":"uuid","entity_name":"Your Name / Firm","callback_number":"+15550001234",
  "voice_persona":"optional style hint","financial_disclaimer":"Educational use only. Not investment advice.",
  "is_default":true }
```
Multiple profiles are allowed (seeds white-label/multi-tenant later); a Job picks one (default if unset). Section 8's prompt and all disclosures are built from the selected profile — nothing entity-related is hardcoded.

### 5.4 Contact (+ multiple numbers, extensible) & Consent
```jsonc
{
  "contact":{
    "id":"uuid","name":"string",
    "phone_numbers":[ { "phone_e164":"+15551234567","label":"mobile","is_primary":true,"is_owned":true } ],
    "timezone":"IANA tz","policy_id":"self|managed_client|open","created_at":""
  },
  "consent":{                          // ignored by SelfCallPolicy; required by ManagedClientPolicy
    "status":"granted|revoked|none","method":"self_owned|web_form|recorded_verbal|written|imported",
    "scope":"automated_ai_voice_calls_about_their_portfolio",
    "granted_at":"","expires_at":"|null","evidence_uri":"","captured_by":"",
    "recording_consent":"granted|denied|unknown"
  }
}
```
A **Job targets exactly one `phone_e164`** (one contact per job for now). To call several numbers (e.g. an institution or a household), the orchestrator **fans out into N jobs** via a helper — the data model already supports multiple numbers per contact, so this is additive, not a refactor.

### 5.5 Owned-numbers allowlist (MVP hard guard)
```jsonc
{ "phone_e164":"+15550001234","label":"my mobile","verified":true,
  "verification_method":"manual_confirm","verified_at":"ISO-8601","added_by":"operator" }
```
**MVP verification = manual confirm** (operator clicks "I confirm I own this number"; record `verified_at`). The dispatch guard dials only verified-owned numbers while `OWNED_NUMBERS_ONLY=true`.

### 5.6 Call Job & Call Record
```jsonc
// Job
{ "id":"uuid","saved_portfolio_id":"uuid","contact_id":"uuid","phone_e164":"+1...",
  "caller_profile_id":"uuid","trigger":"manual|cron|event",
  "status":"queued|optimizing|gated|dialing|in_call|completed|voicemail|blocked|failed",
  "block_reason":"not_owned_number|no_consent|on_dnc|outside_calling_window|frequency_cap|policy_disabled|null",
  "policy_id":"self|managed_client|open","pack_id":"uuid|null","compliance_dir":"path","created_at":"","updated_at":"" }
// Call Record
{ "id":"uuid","job_id":"uuid","provider":"twilio|mock","provider_call_sid":"string|null",
  "started_at":"","ended_at":"","outcome":"answered|voicemail|no_answer|failed|opted_out",
  "mode_chosen":"summary|detail|null","recording_consented":true,
  "transcript_uri":"path|null","disclosures_delivered":["..."] }
```

### 5.7 Compliance artifact bundle (everything in one place)
Per job, write `DATA_DIR/compliance/<job_id>/`:
```
report_pack.json     # exact data sent to the LLM (canonical)
report.html          # human-readable render (json|html|xml acceptable; html default)
report.pdf           # pulled from optimizer /api/export/pdf
admin_log.md         # human-readable admin log (config, gate decisions, outcome)
transcript.txt       # only if recording-consented; else absent
email_<id>.eml       # exact RFC822 copy of any email sent (incl. attachment) — compliance record
events.jsonl         # append-only audit (gate decisions, disclosures delivered, deliveries attempted)
manifest.json        # index: each file + sha256 + size + created_at + retention metadata + delivery status
```
`manifest.json` is the index a **future delivery action** uses to send/email any file. Compute and store **sha256** per file for integrity (supports later WORM/retention). **These artifacts are permanent — never truncated** (distinct from dev process logs in Section 9, which are).

### 5.8 DNC list
`{ "phone_e164":"+1...","added_at":"","source":"verbal_optout|manual|import","note":"" }`. Checked before every dispatch by policies that include the DNC check.

---

## 6. Component specifications

### 6.1 `portfolio-optimizer` (additive)
- **6.1.1 Headless mode** — run FastAPI without Electron on `OPTIMIZER_HEADLESS_PORT` (default `8077`, bind `127.0.0.1`), guarded by `OPTIMIZER_HEADLESS=1`; add `scripts/run-headless.(sh|ps1)`. Behavior unchanged when unset.
- **6.1.2** `POST /api/talking/run` — `{mode:"last"|"saved"|"config", ...}` → `{run_id}`; triggers existing Ollama commentary.
- **6.1.3** `GET /api/talking/pack/{run_id}` → Section 5.1 JSON (add `services/pack_builder.py`); optional `?format=markdown|text|html`.
- **6.1.4 Reuse** `GET /api/export/pdf` for the archived PDF — the orchestrator calls it; do not reimplement.
- **6.1.5 Electron** — Home-page "Talking Portfolio" button → `shell.openExternal(TALKING_PORTFOLIO_URL)` (default `http://localhost:5180`) + a short info page. No telephony here.

### 6.2 `talking-portfolio` orchestrator (new)
Owns registries, the policy framework, job lifecycle, optimizer/call-agent clients, compliance-dir writing, delivery stubs, cron.

Gate (policy-driven), pseudocode:
```ts
async function gate(job){
  const c = await contacts.get(job.contact_id);
  if (config.OWNED_NUMBERS_ONLY && !await ownedNumbers.isVerified(job.phone_e164)) return block("not_owned_number");
  const policy = policyRegistry.for(c.policy_id);          // SelfCallPolicy in MVP
  return policy.evaluate({ contact:c, job, now:new Date() });
}
```

HTTP API:
| Method | Path | Purpose |
|---|---|---|
| CRUD | `/api/portfolios` | saved portfolios |
| CRUD | `/api/contacts` | contacts incl. `phone_numbers[]`, `policy_id` |
| CRUD | `/api/caller-profiles` | the editable `{entity}` profiles |
| GET/POST | `/api/owned-numbers` | manage + **manual-confirm** verification |
| POST | `/api/contacts/:id/consent` | record/revoke (managed tier) |
| GET/POST | `/api/dnc` | view/add |
| POST | `/api/jobs` | kick off (optionally fan-out across selected numbers) |
| GET | `/api/jobs[/:id]` | list/inspect |
| GET | `/api/calls[/:id/transcript]` | records + transcript |
| GET | `/api/compliance/:job_id[/files/:name]` | list/serve bundle files |
| POST | `/api/calls/:id/deliver` | **stub**: `{file,channel,to}` → records intent in manifest/events, returns `queued_stub`, sends nothing in Phase 1 |
| POST | `/api/jobs/:id/approve` | **stub** (maker-checker): approve a job in `pending_approval`; inert unless `APPROVAL_REQUIRED=true` |
| GET | `/api/health` | upstream health |
| WS | `/ws/jobs/:id` | live status + transcript relay |

State machine: `queued → optimizing → [pending_approval] → gated → dialing → in_call → {completed|voicemail|blocked|failed}`. The `pending_approval` step is present but **skipped unless `APPROVAL_REQUIRED=true`** (maker-checker stub, Section 6.5). Cron/event jobs pass the same gate. Persist transitions to `events.jsonl`.

**Email/delivery design (free for testing; provider-swappable).** Model an abstract `DeliveryChannel` with `email` and `sms` implementations. **Send email over plain SMTP via nodemailer** so the provider is swappable by env — do **not** couple to any vendor API. Dev/testing uses **Mailpit** (free, open-source local SMTP that captures messages + attachments in a web UI at `:8025`; nothing leaves the machine, $0, no account) — add it to `dev.sh`/compose and point `SMTP_HOST=127.0.0.1 SMTP_PORT=1025` at it. For real delivery later, aim the same SMTP env at any genuine free-tier provider (e.g. Brevo ~300/day, MailerSend, Resend, SMTP2GO) — a config change, no code change. Mailchimp is **not** used for sending (its transactional tier is paid); the `rsu_vitals` `integrations/mailchimp.py` is relevant only if you later want audience/consent-list management, kept decoupled. **Compliance retention (both, configurable):** on every send (a) write the exact RFC822 message incl. attachment to `compliance/<job_id>/email_<id>.eml` and record it in the manifest, and (b) optionally **BCC** an internal mailbox via `COMPLIANCE_BCC` so a copy lands in your compliance inbox automatically. SMS reuses the existing Twilio account. Phase 1: `deliver` only logs intent + flips `manifest.delivery_status` and sends nothing; wiring the Mailpit send is a small, free first real step whenever you want it.

### 6.3 `talking-portfolio` web app (new)
Pages: **Dashboard** (jobs, health, quick start); **Portfolios** (CRUD); **Contacts** (CRUD, `phone_numbers[]`, `policy_id`; consent sub-panel active only for managed tier); **Owned Numbers** (add + **manual-confirm** — prominent in MVP); **Caller Profiles** (edit `{entity}`, callback number, disclaimer, persona); **Run/Kickoff** (pick portfolio + contact + number + caller profile + summary/detail hint; live status + transcript); **Compliance** (browse `compliance/<job_id>/`, view/download files, see delivery status); **Settings** (endpoints, calling-window/frequency policy, mock toggle; secrets are env-only, never UI).

Guardrail: Launch is disabled with a reason whenever the gate would block. No one-click bypass.

### 6.4 `autonomous-call-agent` (additive)
- **6.4.1** `POST /api/talking-call/dispatch` — `{call_id, phone_e164, report_pack, mode_hint, disclosures{ai_identity,purpose,callback_number,financial_disclaimer,recording_notice,require_recording_consent}, voicemail_script, status_webhook}` → `{accepted, provider_call_sid|null}`. Honors `MOCK_MODE`. **Disclosures, the voicemail script, and flags are opaque inputs from the orchestrator's policy/profile** — the agent does not decide them. This is what keeps the agent unchanged across policy tiers.
- **6.4.2 Grounded prompt** in `ai.ts` (Section 8); replace the generic discovery identity with the Talking Portfolio persona. Never invent figures.
- **6.4.3 Flow:** disclosures → (recording consent if required) → summary/detail → grounded Q&A → opt-out → close. Reuse barge-in. On no-answer/voicemail, speak the supplied `voicemail_script` only.
- **6.4.4 Transcript:** capture + stream to orchestrator via `status_webhook`/WS; orchestrator decides persistence. Agent persists no PII to disk.
- **6.4.5 Opt-out:** configurable phrases → confirm, end, report `opted_out` → orchestrator adds to DNC.
- **6.4.6 (Phase 6) tools:** `lookup_news(ticker)` (Brave) and `rerun_optimizer(param_changes)` with a **whitelist**:
  - **Editable by voice:** `risk_free_rate`, `objective`, `risk_measure`, `start_date`, `end_date`.
  - **Locked:** `method_mu`, `method_cov`.
  Re-run goes orchestrator → optimizer headless → re-inject an updated pack mid-call. Plus `send_report(channel)` calling the delivery stub. All feature-flagged off by default.

### 6.5 Stubbed scaffolding for future phases (inert in MVP)
Add these now as no-ops so the future phases are fill-in, not surgery. All are behind flags defaulting **off**.

- **Event-driven triggers (Phase 9).** The `Job.trigger` enum already includes `event`. Add an `EventTrigger` interface and a `triggers/` dir with a stub evaluator `evaluate(prevRun, latestRun) -> TriggerDecision`. Intended signals: allocation drift vs. the prior saved run, a risk metric (CVaR/MDD) crossing a band, a large move in a holding, a rebalance flag. The optimizer already stores every run as JSON, so this is a diff. MVP ships the interface + a `noop` evaluator; flag `EVENT_TRIGGERS_ENABLED=false`.
- **Maker-checker approval (Phase 8).** Add the `pending_approval` job state (Section 6.2) and `POST /api/jobs/:id/approve`. When `APPROVAL_REQUIRED=true`, the runner halts at `pending_approval` and surfaces the report + generated talking points in the UI for the operator to approve/reject before `gated`. MVP: state + endpoint exist but are skipped.
- **Inbound calls (Phase 10).** In the call agent, stub a Twilio **Voice webhook** route (e.g. `POST /incoming`) that returns TwiML `<Connect><Stream>` pointing at the *same* media-stream WebSocket the outbound path uses — so the Gemini Live bridge (transcoding, barge-in) is reused unchanged. Add a `resolveInboundCaller(fromNumber) -> {contact, latestPack}` stub plus an identity step (reuse the policy `identityCheck`) before any disclosure. Flag `INBOUND_ENABLED=false`. *How it works with Gemini Live:* inbound is the same audio bridge as outbound, just entered from a webhook instead of an originated call; the only new logic is the TwiML route, caller→report resolution, and identity verification before grounding.

---

## 7. RecipientPolicy framework (extensible compliance core)

> Who may be called and which protections fire is decided by one swappable `RecipientPolicy`. MVP ships `SelfCallPolicy`. Adding "consenting clients" = add `ManagedClientPolicy`, set the contact's `policy_id` — no change to the call agent, pack, or job runner.

### 7.1 Interface
```ts
interface RecipientPolicy {
  id: "self" | "managed_client" | "open";
  evaluate(ctx: CallContext): Promise<GateResult>;  // {allow, reason?, disclosures, requireRecordingConsent, requireIdentityVerification}
  buildDisclosures(ctx: CallContext): Disclosures;   // built from the selected CallerProfile
  onOptOut(ctx: CallContext): Promise<void>;         // default: add to DNC
}
```
Checks are small composable functions: `consentCheck`, `dncCheck`, `callingWindowCheck`, `frequencyCapCheck`, `identityCheck`, `recordingConsentDecision`. A policy is mostly a declared list of which checks run.

### 7.2 Unconditional outer guard
Before any policy runs, enforce the **owned-numbers allowlist** when `OWNED_NUMBERS_ONLY=true` (default). Non-owned → `not_owned_number`. Permanent safety net; keep enabled until you intend to call others. **Fail closed:** any error in the guard → block.

### 7.3 `SelfCallPolicy` (MVP)
| Check | Behavior | Rationale |
|---|---|---|
| consent | auto-granted (`self_owned`) for owned numbers | can't lack consent to call yourself |
| DNC | still checked | lets you suppress your own number |
| calling window | skipped (`SELF_CALL_IGNORE_WINDOW=true`) | call yourself anytime |
| frequency cap | skipped/generous | testing |
| identity | none | you know who answers |
| recording consent | auto-granted (single-party) → transcript persists | |
| disclosures | still delivered (AI identity + not-advice), from CallerProfile | keeps flow identical for later tiers |

### 7.4 `ManagedClientPolicy` (Phase 7 — design now, implement later)
Runs the full set: `consentCheck` (granted, unexpired, scoped, with evidence — captured via a **hosted web consent form**, double-opt-in style); `dncCheck`; `callingWindowCheck` (callee local time, default 08:00–21:00; resolve tz from contact/E.164; unknown → require explicit tz); `frequencyCapCheck` (default 1/contact/day); `identityCheck` (verify the right person before disclosing data); `recordingConsentDecision` (two-party worst case — verbal consent before any transcript). `buildDisclosures` adds entity + callback + purpose + recording notice. Enabling = implement, register, set `policy_id`, and (only when ready) flip `OWNED_NUMBERS_ONLY=false`.

### 7.5 Audit
Every block (with reason) and disclosure delivered is timestamped into `events.jsonl`. On from MVP.

---

## 8. Conversation design
System instruction built by `ai.ts` from the pack + selected CallerProfile:
```
You are an automated voice assistant calling on behalf of {entity_name}. You are an AI, not a human;
you have already disclosed this. You are discussing ONE portfolio optimization report.

HARD RULES:
- Answer ONLY from the REPORT below; never invent or estimate numbers not present in it.
- If asked something the report doesn't cover, say so and offer what you do have.
- Educational commentary, NOT investment advice. Do not recommend buying/selling.
- On opt-out, confirm, stop, end the call.
- Summary answers ~30–60s; expand only if asked.

FLOW: deliver disclosures → (recording consent if required) → ask: quick summary or detailed walkthrough?
→ deliver chosen mode → take follow-up questions → offer to end.

CALLBACK: {callback_number}.   DISCLAIMER: {financial_disclaimer}.
REPORT (authoritative): {report_pack}
```
**Voicemail script (supplied by orchestrator):** *"Hi, this is an automated assistant calling on behalf of {entity_name}. A portfolio optimization focused on {objective_plain} has been prepared for you, and a detailed report will follow by email. This is for educational purposes, not investment advice."* — no holdings/figures.

---

## 9. Developer ergonomics — one-command dev loop

The operator wants to avoid juggling terminals. Provide **one start script** and one stop script in `talking-portfolio/scripts/`.

`scripts/dev.sh` (start everything in the background):
1. **Start ngrok** for the call agent: `ngrok http 3334` (Twilio's only public target).
2. **Auto-wire the tunnel:** poll `http://127.0.0.1:4040/api/tunnels`, extract the `https` `public_url`, write it into the call agent's `.env` as `PUBLIC_URL` (idempotent sed/replace). *(This automates the manual step the call-agent README otherwise requires on every restart.)*
3. **Launch services in the background with truncated logs** (note `>` truncates each run — exactly the "rewrite log on restart" behavior requested):
   ```
   nohup <optimizer headless :8077>  > logs/optimizer.log 2>&1 &   echo $! >> .dev/pids
   nohup <call-agent backend :3334>  > logs/callagent.log 2>&1 &   echo $! >> .dev/pids
   nohup <orchestrator :5179>        > logs/orchestrator.log 2>&1 & echo $! >> .dev/pids
   nohup <web app :5180>             > logs/web.log 2>&1 &          echo $! >> .dev/pids
   ```
4. **Health-check** each port, then print all URLs (web UI, orchestrator, ngrok URL).

`scripts/dev-stop.sh`: kill PIDs in `.dev/pids` + the ngrok process. `scripts/dev-logs.sh [svc]`: `tail -f logs/<svc>.log`.

Rules: **only the dev process logs in `logs/` are truncated** — the **compliance bundle (Section 5.7) is never truncated**. Document this workflow in CLAUDE.md.

> Notes for the agent: free-tier ngrok = one tunnel and a URL that changes each restart (hence step 2). A free **static ngrok domain** (or paid) makes `PUBLIC_URL` stable and step 2 a no-op — recommend the operator set one to remove churn. A `pm2` ecosystem file (`pm2 start/stop/restart/logs/flush`) is an acceptable alternative if per-process restart/log management is wanted, at the cost of one dependency; default to the plain script since "one script" was requested.

---

## 10. Configuration & environment
`talking-portfolio/.env`:
```
PORT=5179
WEB_PORT=5180
OPTIMIZER_BASE_URL=http://127.0.0.1:8077
CALL_AGENT_BASE_URL=http://127.0.0.1:3334
DB_PATH=./data/talking-portfolio.sqlite
DATA_DIR=./data                  # contains compliance/<job_id>/...
LOG_DIR=./logs                   # dev process logs ONLY (truncated each restart)
OWNED_NUMBERS_ONLY=true
DEFAULT_POLICY_ID=self
SELF_CALL_IGNORE_WINDOW=true
CALLING_WINDOW_START=08:00
CALLING_WINDOW_END=21:00
FREQUENCY_CAP_PER_DAY=1
MOCK_MODE=true
# Email — SMTP (free for testing via Mailpit; swap host for a free-tier provider later):
SMTP_HOST=127.0.0.1          # Mailpit in dev (web UI :8025, SMTP :1025)
SMTP_PORT=1025
SMTP_USER=                   # empty for Mailpit; set for a real provider
SMTP_PASS=
EMAIL_FROM="Your Name <noreply@example.com>"
COMPLIANCE_BCC=              # optional internal mailbox BCC'd on every send
# Future-phase feature flags (all default off):
APPROVAL_REQUIRED=false
EVENT_TRIGGERS_ENABLED=false
INBOUND_ENABLED=false
# Default CallerProfile seed (editable later in the web app):
DEFAULT_ENTITY_NAME="Your Name"
DEFAULT_CALLBACK_NUMBER=+15550001234
```
`portfolio-optimizer`: `OPTIMIZER_HEADLESS=1`, `OPTIMIZER_HEADLESS_PORT=8077`, `TALKING_PORTFOLIO_URL=http://localhost:5180`.
`autonomous-call-agent`: existing env unchanged; `PUBLIC_URL` auto-written by `dev.sh`; keep `MOCK_MODE`/`MOCK_CALL_TARGET` (point at your phone).

---

## 11. Security
Secrets env-only (never DB/UI/repo/logs); honor OpenClaw `SecretRef`. Inter-service HTTP on `127.0.0.1`; shared bearer token if exposed. Normalize phones to E.164 server-side. Orchestrator is the only PII store — least-privilege perms on `DATA_DIR`/SQLite/compliance dir. Redact phone/PII in process logs; full values only in access-controlled records. sha256 every compliance file for integrity.

---

## 12. Logging & observability
- **Admin log** (per job, human-readable, in the compliance dir): config, rendered summary, gate decisions, outcome.
- **Transcript** (per call): persisted only when recording consent satisfied (auto in self-call).
- **events.jsonl** (per job): append-only audit of gates, disclosures, deliveries.
- **Live relay** via WS to the UI. **Dev process logs** in `LOG_DIR`, truncated each restart, PII-redacted.

---

## 13. Testing
- **Self-call e2e (primary):** call agent in `MOCK_MODE`, `MOCK_CALL_TARGET`=your phone, contact = owned/verified number, `policy_id=self`. Hear disclosures + summary/detail.
- **Owned-numbers guard (critical):** non-owned → `not_owned_number`, no dispatch; guard fails closed.
- **Optimizer contracts:** `/api/talking/run` + `/api/talking/pack` valid; PDF retrievable; compliance dir populated with manifest + sha256.
- **Policy framework:** stub `ManagedClientPolicy` blocks on each missing protection (consent/DNC/window/freq/identity) — proves extensibility.
- **Opt-out:** verbal → `opted_out` → DNC → next job blocked.
- **Voicemail:** unanswered → limited script, no figures, outcome `voicemail`.
- **Grounding:** out-of-pack question → declines, no fabrication.
- **Delivery stub:** `deliver` records intent + flips manifest status, sends nothing. (When email is wired, a Mailpit-backed test asserts the `.eml` is archived and `COMPLIANCE_BCC` is honored.)
- **Stub inertness:** with flags off, `pending_approval` is skipped, the event evaluator is `noop`, and the inbound route is disabled — none alter MVP behavior.
- **Optimizer regression:** unchanged behavior when `OPTIMIZER_HEADLESS` unset.

---

## 14. Acceptance criteria (MVP)
1. Manual + cron kickoff run the optimizer on saved/last portfolio and write `compliance/<job_id>/` with pack JSON, HTML render, **PDF**, admin log, manifest (with sha256).
2. With an owned, manually-confirmed number (mock → your phone), the agent calls, discloses AI + entity + not-advice, then offers summary vs detail.
3. Agent answers ≥3 in-pack questions correctly and declines an out-of-pack question without fabricating.
4. Owned-numbers guard blocks any non-owned number; fails closed.
5. Policy framework present: `SelfCallPolicy` resolves checks for owned numbers; stub `ManagedClientPolicy` blocks per missing protection.
6. Opt-out ends call + adds to DNC; subsequent job blocked.
7. Unanswered → limited voicemail; outcome `voicemail`.
8. `{entity}` is editable in the web app and flows into the live prompt, disclosures, and voicemail.
9. Transcript persists in self-call; agent stores no PII to disk.
10. `deliver` stub records intent without sending; `dev.sh` brings the whole stack up in the background with truncated dev logs and an auto-wired ngrok URL.
11. Optimizer's offline/Electron behavior unchanged when `OPTIMIZER_HEADLESS` unset.

---

## 15. Assumptions & resolved decisions
**Resolved (from operator):** org = new `talking-portfolio` repo; brain = Gemini Live with report injected; MVP = self-call with extensible policy framework; owned-number verification = **manual confirm**; voicemail = **limited** (objective + "report from {entity}, email to follow"; email stubbed in Phase 1); managed-tier consent (Phase 7) = **hosted web consent form**; re-run whitelist = `risk_free_rate, objective, risk_measure, start_date, end_date` editable / `method_mu, method_cov` locked; **one contact per job now**, model extensible to multiple numbers (fan-out = N jobs); archive a **PDF** + the LLM data file + logs in a per-job **compliance directory**; email via **SMTP/nodemailer**, free for testing with **Mailpit**, provider-swappable later (no Mailchimp for sending); compliance email retention = **`.eml` archive + optional `COMPLIANCE_BCC`**; **event triggers, maker-checker approval, and inbound calls are stubbed now** and scheduled as Phases 8–10 (Section 18); cross-product briefing dropped; provide a **one-command background dev loop** with truncated logs + ngrok auto-wire (also in CLAUDE.md).

**Still open (non-blocking):**
1. Which free-tier SMTP provider to use for *real* sends (Brevo / MailerSend / Resend / SMTP2GO) — decide when leaving Mailpit; it's a config change.
2. Compliance retention policy (how long to keep bundles; WORM?) — relevant for the institutional path.
3. Whether to also offer an SMS recap (cheap via the existing Twilio account) alongside email.

---

## 16. Risks
- **Regulatory (deferred):** self-call is low-exposure, but the architecture exists to eventually call others — Phase 7 + counsel review before flipping `OWNED_NUMBERS_ONLY=false`. Rules evolving as of 2026.
- **Guard bypass:** owned-numbers guard is the boundary — test hard, fail closed.
- **Hallucinated figures:** strict grounding + grounding tests; tight summary scripts.
- **Latency:** keep pack < ~8 KB; prefer `headline` for summary mode.
- **Secret sprawl:** reuse existing keys; never duplicate into the repo.
- **Offline regression:** `OPTIMIZER_HEADLESS` guard; verify in acceptance.

---

## 17. Disclaimers
Technical guidance, not legal or financial advice. Educational only; never present recommendations as advice. Self-call MVP minimizes exposure by calling only owned numbers. Before any call to another person, confirm current telephony, AI-disclosure, recording-consent, and financial-communication requirements per jurisdiction with counsel, and complete Phase 7.

---

## 18. Roadmap — scheduled phases & future value

> Phases 8–10 are **scaffolded in MVP** (Section 6.5) and scheduled here with acceptance hints. The rest are unprioritized ideas, curated by leverage.

### Scheduled (stubbed now)
**Phase 8 — Maker-checker approval.** Turn on the `pending_approval` state + `/api/jobs/:id/approve` + a UI review screen showing the report and generated talking points. *Done when:* with `APPROVAL_REQUIRED=true`, no call dispatches until an operator approves; rejected jobs end `blocked` with reason `not_approved`.

**Phase 9 — Event-driven triggers.** Implement the `EventTrigger` evaluator: diff the latest run vs. the prior saved run and fire on drift/risk-band/large-move/rebalance signals. *Done when:* an `event`-triggered job is created automatically when a configured threshold is crossed and not otherwise, and the trigger reason is recorded on the job.

**Phase 10 — Inbound calls.** Implement the Twilio Voice webhook + TwiML `<Connect><Stream>` reusing the existing Gemini Live media bridge, plus caller→contact resolution and an identity step before disclosure. *Done when:* dialing the configured number connects the caller to a grounded conversation about *their* latest report, after identity verification, with the same disclosures/opt-out as outbound.

### Unprioritized ideas
**Individuals**
- **Multi-channel recap:** post-call SMS summary + emailed PDF (SMS reuses Twilio).
- **Cross-call memory (with consent):** "last month you asked about your tech concentration; it's now X%." Continuity over one-off reports.
- **Goal/benchmark framing:** answer "am I on track?" against a benchmark or target, not just absolute metrics.
- **Accessibility & multilingual:** voice serves low-vision/driving users; Gemini Live is multilingual — set call language per contact.

**Institutions**
- **Multi-tenant / white-label:** CallerProfiles already abstract `{entity}` — extend to per-firm logo, disclaimers, voice persona; one deployment serves many advisors.
- **Compliance & retention hardening:** WORM-style immutable bundle + retention schedule + exportable audit package (aligns with books-and-records expectations like SEC 17a-4). The sha256 manifest + `.eml` archive are the foundation.
- **CRM integration:** push call outcomes/transcripts to Salesforce/HubSpot; pull contacts/consent from the system of record.
- **Consent at scale:** bulk import, double-opt-in web form, expiry reminders, instant revocation propagation to the gate.
- **Question analytics:** aggregate which questions clients ask most → advisor coaching and product insight.
- **Webhook/event bus:** emit job/call events so institutions can wire their own automation.
