# Mini AI Lead + CRM System

A small working app that takes a free-text customer message, extracts lead
info, lets the customer pick a meeting slot, and stores everything (contact,
lead, conversation, appointment) in a simple CRM you can browse in a
dashboard. Includes a free browser-based Voice Demo. **No paid services are
used anywhere.**

## Live Demo
Run locally with the steps below (see "Run it").

## Architecture

```
mini-ai-crm/
├── server.js               Express server for LOCAL dev (JSON file storage)
├── netlify.toml             Netlify build/redirect config
├── netlify/functions/
│   └── api.js                Same API, packaged as a Netlify Function
│                              (used in production — storage via Netlify Blobs)
├── data/db.json               Flat-file JSON "database" (local dev only)
├── public/
│   ├── index.html      3-tab UI: AI Intake, Voice Demo, CRM Dashboard
│   ├── style.css
│   └── app.js           Frontend logic, calls the REST API
└── package.json
```

**Backend (Node.js + Express)**
- `POST /api/message` — runs the message through a rule-based extraction
  pipeline (regex/keyword based, no paid LLM) that pulls out:
  - **Name** — pattern matches like "I'm X", "my name is X", "this is X"
  - **Requirement** — clause after verbs like "need", "want", "looking for",
    "interested in" (falls back to the full message)
  - **Lead status** — Hot / Warm / Cold, scored from urgency & intent
    keywords ("tomorrow", "asap", "schedule" → Hot; "interested", "want" →
    Warm; otherwise Cold)
  - Also returns 3 mock available meeting slots (tomorrow, 2 hrs apart).
- `POST /api/book` — once a slot is picked, saves a **Contact**, **Lead**,
  **Conversation**, and **Appointment** record, all linked by IDs, into
  `data/db.json`.
- `GET /api/crm` — returns all records for the dashboard.
- `POST /api/reset` — clears demo data (handy for re-recording demos).

**Storage**: a flat JSON file (`data/db.json`) acting as a mini relational
store with 4 "tables". Chosen for zero-setup / zero-cost — easy to swap for
SQLite/Postgres later without changing the API surface.

**Frontend**: plain HTML/CSS/JS, 3 tabs:
1. **AI Intake** — paste a message → see extracted fields (editable) → pick a
   slot → confirm booking.
2. **Voice Demo** — uses the browser's built-in `SpeechRecognition` API to
   capture speech (Chrome recommended) and `SpeechSynthesis` to speak
   confirmations back. Fully free, runs client-side, no telephony/paid APIs.
   If the browser doesn't support speech APIs, you can type the transcript
   manually and the same pipeline runs.
3. **CRM Dashboard** — tables for Contacts, Leads, Conversations,
   Appointments, pulled live from `/api/crm`.

## Why this stack
- No paid services required (per assignment constraint) — the "AI" step is a
  transparent, explainable rule-based extractor rather than a paid LLM API.
  It's straightforward to swap in a free-tier LLM (or a local model via
  Ollama) by replacing `extractInfo()` in `server.js` with an API call —
  the rest of the app (slots, booking, CRM, voice) doesn't need to change.
- Zero external dependencies beyond Express — runs anywhere Node runs, no DB
  server to install, easy to demo in under a minute.

## Run it locally

```bash
npm install
npm start
```

Then open **http://localhost:3000**

Try the example message (pre-filled in the textbox):

> "Hi, I'm Rahul. I need an AI calling solution and would like to schedule a meeting tomorrow."

Expected extraction: Name = Rahul, Requirement = "an AI calling solution",
Status = Hot (because of "tomorrow" + "schedule").

## Deploy to Netlify

The Express server (`server.js`) is for **local development only** — it
writes to a local JSON file, which doesn't persist on Netlify's serverless
platform. For production, the same API logic runs as a **Netlify Function**
(`netlify/functions/api.js`) backed by **Netlify Blobs** for storage (free,
no paid service, persists across requests — unlike a flat file on a
stateless function).

**One-time setup:**
1. Push this repo to GitHub (already done ✅)
2. Go to [app.netlify.com](https://app.netlify.com) → "Add new site" →
   "Import an existing project" → pick this repo
3. Build settings (should auto-detect from `netlify.toml`, but confirm):
   - Build command: `npm install`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Deploy. Netlify Blobs works automatically on Netlify's own infra — no
   extra config or API keys needed.

**How routing works:** the frontend calls `/api/message`, `/api/book`,
etc. `netlify.toml` redirects `/api/*` → the serverless function, which
handles all four routes (`/message`, `/book`, `/crm`, `/reset`) the same
way `server.js` does locally.

**CLI alternative** (if you'd rather deploy from terminal):
```bash
npm install -g netlify-cli
netlify login
netlify init      # links this repo to a new/existing Netlify site
netlify deploy --prod
```

## Possible future improvements
- Swap rule-based extraction for a free-tier/local LLM for more robust NLP
- Real calendar integration for slots (Google Calendar free API)
- Auth + multi-user CRM
- SQLite instead of flat JSON for concurrent writes

## Contribution
Built end-to-end (backend, extraction logic, CRM data model, frontend UI,
voice demo integration) as a solo submission for this assignment.