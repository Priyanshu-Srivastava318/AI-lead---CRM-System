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
├── server.js         Express backend: extraction logic + CRM REST API
├── data/db.json       Flat-file JSON "database" (contacts/leads/conversations/appointments)
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

## Run it

```bash
npm install
npm start
```

Then open **http://localhost:3000**

Try the example message (pre-filled in the textbox):

> "Hi, I'm Rahul. I need an AI calling solution and would like to schedule a meeting tomorrow."

Expected extraction: Name = Rahul, Requirement = "an AI calling solution",
Status = Hot (because of "tomorrow" + "schedule").

## Possible future improvements
- Swap rule-based extraction for a free-tier/local LLM for more robust NLP
- Real calendar integration for slots (Google Calendar free API)
- Auth + multi-user CRM
- SQLite instead of flat JSON for concurrent writes

## Contribution
Built end-to-end (backend, extraction logic, CRM data model, frontend UI,
voice demo integration) as a solo submission for this assignment.
