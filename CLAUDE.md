# CLAUDE.md — Talking Portfolio

Operating guide for the coding agent working in the **`talking-portfolio`** repo. Full detail lives in `talking-portfolio-spec.md` (read it first). This file is the short, always-applies version.

## What this is
An orchestrator + web control panel that runs the existing Portfolio Optimizer on a saved portfolio, then has an AI voice agent **call the operator's own phone** to discuss the result. MVP is **self-call only**. The compliance layer is a pluggable `RecipientPolicy`; a future "consenting clients" tier drops in without touching the call flow.

## Three repos (get code + reuse existing .env keys from these local paths)
| Component | Local path | Role |
|---|---|---|
| Optimizer | `/home/master/Software/portfolio_mngt/cc_riskfolio/portfolio-optimizer` | FastAPI + Riskfolio + Ollama; has `/api/export/pdf` |
| Call agent | `/home/master/Software/openclaw/voicecall-app/backend` | Node/TS + Twilio + Gemini Live (the `autonomous-call-agent` code) |
| This repo | `talking-portfolio` (new) | orchestrator + web UI |

**Reuse existing secrets** (Twilio, Gemini, Brave) from those repos' `.env`/secrets. Never regenerate keys. If a key is missing, say so — don't invent one. Email is **not** Mailchimp: send over SMTP (nodemailer); dev uses **Mailpit** (free, local, $0).

## Hard rules (do not violate)
1. **Owned-numbers guard is the safety boundary.** While `OWNED_NUMBERS_ONLY=true`, never dial a number that isn't operator-verified. The guard runs before any policy and **fails closed** (any error → block).
2. **No real call to a non-owned number until Phase 7** (ManagedClientPolicy) is built, tested, and counsel-reviewed.
3. **Never commit secrets.** Env only. Honor OpenClaw `SecretRef`.
4. **Never truncate the compliance bundle** (`DATA_DIR/compliance/<job_id>/`) — including any `.eml` email archives. Only the dev process logs in `LOG_DIR` are truncated on restart.
5. **The call agent must not persist PII to disk.** Transcripts are persisted by the orchestrator, and only when recording consent is satisfied.
6. **Grounding:** the voice agent answers only from the Report Context Pack. No invented numbers. Educational commentary, never investment advice.
7. **Entity is configurable** (CallerProfile) — never hardcode entity name, callback number, or disclaimers.

## Dev loop — one command, no terminal juggling
- `scripts/dev.sh` starts **everything in the background**: ngrok → auto-writes the public URL into the call agent's `.env` as `PUBLIC_URL` → optimizer headless (:8077), call-agent backend (:3334), orchestrator (:5179), web app (:5180). Each service logs to `logs/<svc>.log` opened with `>` so the log is **rewritten each restart**. PIDs go to `.dev/pids`.
- `scripts/dev-stop.sh` kills everything (PIDs + ngrok). `scripts/dev-logs.sh [svc]` tails a log.
- The ngrok auto-wire (poll `http://127.0.0.1:4040/api/tunnels`, sed `PUBLIC_URL`, then boot the backend) removes the manual step the call-agent README otherwise needs every restart. If the operator sets a **static ngrok domain**, that step becomes a no-op — prefer it.
- Keep `MOCK_MODE=true` and `MOCK_CALL_TARGET` pointed at the operator's phone for all self-call testing.

## Build order
~~P1 optimizer hooks~~ ✅ → ~~P2 orchestrator core + registries + compliance dir + PDF archival~~ ✅ → **P3 policy framework + SelfCallPolicy + owned-numbers guard + audit** (stubs are wired; guard + policy already call through in `jobRunner.ts` — needs end-to-end test) → **P4 call agent: `/api/talking-call/dispatch`, grounded prompt, disclosures, voicemail, transcript, opt-out** = **MVP** → P5 news lookup → P6 constrained rerun + `send_report` → P7 ManagedClientPolicy + hosted consent form (then consider enabling non-owned calls) → P8 maker-checker approval → P9 event-driven triggers → P10 inbound calls.

**Scaffold P8–P10 inertly during MVP** (see spec §6.5): the `pending_approval` state + `/api/jobs/:id/approve`, the `event` trigger interface + `noop` evaluator, and the inbound Twilio webhook/TwiML route — all behind flags (`APPROVAL_REQUIRED`, `EVENT_TRIGGERS_ENABLED`, `INBOUND_ENABLED`) defaulting **off**, so they don't affect MVP behavior.

## Definition of done for MVP
See spec §14. In short: self-call works end-to-end in mock mode; compliance bundle (pack JSON + HTML + PDF + admin log + manifest w/ sha256) is written; owned-numbers guard blocks non-owned and fails closed; a stub ManagedClientPolicy proves each gate blocks; opt-out → DNC; voicemail is limited; `{entity}` flows from the web app into prompt/disclosures/voicemail; `dev.sh` brings the stack up in the background; optimizer offline behavior unchanged when `OPTIMIZER_HEADLESS` unset.

## Style
Match each repo's existing stack and conventions (the optimizer and call agent each have their own CLAUDE.md — read them). Prefer small, additive changes to the two existing repos; put new/regulated logic in this repo. Ask before introducing a new heavy dependency.
