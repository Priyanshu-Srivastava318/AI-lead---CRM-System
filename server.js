/**
 * Mini AI Lead + CRM System - Backend
 * Stack: Node.js + Express + lowdb-style JSON file storage (no paid services)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Simple JSON "database" ----------
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { contacts: [], leads: [], conversations: [], appointments: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function id() {
  return crypto.randomBytes(6).toString('hex');
}

// ---------- Rule-based "AI" extraction ----------
// No paid LLM API used. This is a lightweight NLP/regex pipeline that
// extracts name, requirement and lead status from a free-text message.
// (Swappable later with a local LLM / free-tier API if desired.)
function extractInfo(message) {
  const text = message.trim();

  // --- Name extraction ---
  let name = null;
  const namePatterns = [
    /\bi'?m\s+([A-Z][a-zA-Z]+)/i,
    /\bi am\s+([A-Z][a-zA-Z]+)/i,
    /\bmy name is\s+([A-Z][a-zA-Z]+)/i,
    /\bthis is\s+([A-Z][a-zA-Z]+)/i,
    /\bname[:\-]\s*([A-Z][a-zA-Z]+)/i,
  ];
  for (const p of namePatterns) {
    const m = text.match(p);
    if (m) { name = m[1]; break; }
  }
  if (!name) name = 'Unknown';

  // --- Requirement extraction ---
  // Grab clause(s) after common need-expressing verbs.
  let requirement = null;
  const reqPatterns = [
    /\bi need\s+(.+?)(?:\.|,|\band\b|\bwould\b|$)/i,
    /\bi want\s+(.+?)(?:\.|,|\band\b|\bwould\b|$)/i,
    /\bi'?m looking for\s+(.+?)(?:\.|,|\band\b|\bwould\b|$)/i,
    /\blooking for\s+(.+?)(?:\.|,|\band\b|\bwould\b|$)/i,
    /\binterested in\s+(.+?)(?:\.|,|\band\b|\bwould\b|$)/i,
    /\brequire\s+(.+?)(?:\.|,|\band\b|\bwould\b|$)/i,
  ];
  for (const p of reqPatterns) {
    const m = text.match(p);
    if (m) { requirement = m[1].trim(); break; }
  }
  if (!requirement) requirement = text; // fallback: whole message

  // --- Lead status scoring ---
  // Hot   -> explicit urgency / scheduling intent (today, tomorrow, asap, schedule, book)
  // Warm  -> general interest, no immediate urgency
  // Cold  -> vague / informational only
  const lower = text.toLowerCase();
  let status = 'Cold';
  const hotWords = ['tomorrow', 'today', 'asap', 'urgent', 'schedule', 'book a', 'meeting', 'call me', 'right away'];
  const warmWords = ['interested', 'want', 'need', 'looking for', 'considering', 'planning'];
  if (hotWords.some(w => lower.includes(w))) status = 'Hot';
  else if (warmWords.some(w => lower.includes(w))) status = 'Warm';

  return { name, requirement, status };
}

// ---------- Mock available slots ----------
function getMockSlots() {
  const slots = [];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0); // tomorrow 10 AM
  const offsets = [0, 2, 4]; // hours apart -> 10AM, 12PM, 2PM
  offsets.forEach((h, idx) => {
    const slotTime = new Date(base.getTime() + h * 60 * 60 * 1000);
    slots.push({
      id: 'slot_' + idx,
      label: slotTime.toLocaleString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit', hour12: true
      }),
      iso: slotTime.toISOString(),
    });
  });
  return slots;
}

// ================== API ROUTES ==================

// 1. Process an incoming message -> extract name/requirement/status + return slots
app.post('/api/message', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const extracted = extractInfo(message);
  const slots = getMockSlots();
  res.json({ extracted, slots, rawMessage: message });
});

// 2. Confirm booking -> save contact, lead, conversation, appointment
app.post('/api/book', (req, res) => {
  const { name, requirement, status, rawMessage, slot } = req.body;
  if (!name || !slot) {
    return res.status(400).json({ error: 'name and slot are required' });
  }
  const db = readDB();

  // Contact (dedupe by name, simple demo logic)
  let contact = db.contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!contact) {
    contact = { id: id(), name, createdAt: new Date().toISOString() };
    db.contacts.push(contact);
  }

  // Lead
  const lead = {
    id: id(),
    contactId: contact.id,
    requirement: requirement || 'N/A',
    status: status || 'Warm',
    createdAt: new Date().toISOString(),
  };
  db.leads.push(lead);

  // Conversation
  const conversation = {
    id: id(),
    contactId: contact.id,
    leadId: lead.id,
    message: rawMessage || '',
    channel: 'chat',
    createdAt: new Date().toISOString(),
  };
  db.conversations.push(conversation);

  // Appointment
  const appointment = {
    id: id(),
    contactId: contact.id,
    leadId: lead.id,
    slotLabel: slot.label,
    slotIso: slot.iso,
    createdAt: new Date().toISOString(),
  };
  db.appointments.push(appointment);

  writeDB(db);
  res.json({ contact, lead, conversation, appointment });
});

// 3. CRM dashboard data
app.get('/api/crm', (req, res) => {
  const db = readDB();
  res.json(db);
});

// 4. Reset demo data (handy for screen recording / re-testing)
app.post('/api/reset', (req, res) => {
  writeDB({ contacts: [], leads: [], conversations: [], appointments: [] });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Mini AI Lead + CRM System running at http://localhost:${PORT}`);
});
