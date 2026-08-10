/**
 * Mini AI Lead + CRM System — Netlify Function
 * Same logic as server.js, adapted to run as a serverless function.
 * Storage: Netlify Blobs (free, persists across invocations — a plain
 * JSON file on disk would NOT persist between serverless calls).
 */
const express = require('express');
const serverless = require('serverless-http');
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const app = express();
app.use(express.json());

function store() {
  return getStore('crm-data');
}

async function readDB() {
  const s = store();
  const data = await s.get('db', { type: 'json' });
  if (!data) {
    const initial = { contacts: [], leads: [], conversations: [], appointments: [] };
    await s.setJSON('db', initial);
    return initial;
  }
  return data;
}
async function writeDB(db) {
  await store().setJSON('db', db);
}
function id() {
  return crypto.randomBytes(6).toString('hex');
}

// ---------- Rule-based "AI" extraction (same as server.js) ----------
function extractInfo(message) {
  const text = message.trim();

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
  if (!requirement) requirement = text;

  const lower = text.toLowerCase();
  let status = 'Cold';
  const hotWords = ['tomorrow', 'today', 'asap', 'urgent', 'schedule', 'book a', 'meeting', 'call me', 'right away'];
  const warmWords = ['interested', 'want', 'need', 'looking for', 'considering', 'planning'];
  if (hotWords.some(w => lower.includes(w))) status = 'Hot';
  else if (warmWords.some(w => lower.includes(w))) status = 'Warm';

  return { name, requirement, status };
}

function getMockSlots() {
  const slots = [];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0);
  const offsets = [0, 2, 4];
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

// ================== ROUTES ==================
// Mounted under /api/* via netlify.toml redirect -> /.netlify/functions/api/*
// serverless-http basePath strips the function prefix, so routes below
// are relative (e.g. "/message" matches "/api/message").

app.post('/message', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const extracted = extractInfo(message);
  const slots = getMockSlots();
  res.json({ extracted, slots, rawMessage: message });
});

app.post('/book', async (req, res) => {
  const { name, requirement, status, rawMessage, slot } = req.body;
  if (!name || !slot) {
    return res.status(400).json({ error: 'name and slot are required' });
  }
  const db = await readDB();

  let contact = db.contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!contact) {
    contact = { id: id(), name, createdAt: new Date().toISOString() };
    db.contacts.push(contact);
  }

  const lead = {
    id: id(),
    contactId: contact.id,
    requirement: requirement || 'N/A',
    status: status || 'Warm',
    createdAt: new Date().toISOString(),
  };
  db.leads.push(lead);

  const conversation = {
    id: id(),
    contactId: contact.id,
    leadId: lead.id,
    message: rawMessage || '',
    channel: 'chat',
    createdAt: new Date().toISOString(),
  };
  db.conversations.push(conversation);

  const appointment = {
    id: id(),
    contactId: contact.id,
    leadId: lead.id,
    slotLabel: slot.label,
    slotIso: slot.iso,
    createdAt: new Date().toISOString(),
  };
  db.appointments.push(appointment);

  await writeDB(db);
  res.json({ contact, lead, conversation, appointment });
});

app.get('/crm', async (req, res) => {
  const db = await readDB();
  res.json(db);
});

app.post('/reset', async (req, res) => {
  await writeDB({ contacts: [], leads: [], conversations: [], appointments: [] });
  res.json({ ok: true });
});

module.exports.handler = serverless(app, {
  basePath: '/.netlify/functions/api',
});