// ===================== Tab switching =====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'crm') loadCRM();
  });
});

// ===================== Shared helpers =====================
async function apiRequest(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await res.json()
    : { error: await res.text() || `Request failed (${res.status})` };

  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

function showRequestError(error) {
  console.error(error);
  alert(`Could not complete the request: ${error.message}`);
}

function renderSlots(container, slots, onSelect) {
  container.innerHTML = '';
  let selected = null;
  slots.forEach(slot => {
    const div = document.createElement('div');
    div.className = 'slot-option';
    div.innerHTML = `<input type="radio" name="slot-${container.id}" /> <span>${slot.label}</span>`;
    div.addEventListener('click', () => {
      container.querySelectorAll('.slot-option').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      div.querySelector('input').checked = true;
      selected = slot;
      onSelect(slot);
    });
    container.appendChild(div);
  });
}

// ===================== TAB 1: Chat / AI Intake =====================
let chatSlots = [];
let chatSelectedSlot = null;
let chatRawMessage = '';

document.getElementById('extractBtn').addEventListener('click', async () => {
  const message = document.getElementById('msgInput').value;
  if (!message.trim()) return alert('Please enter a message.');
  chatRawMessage = message;

  let data;
  try {
    data = await apiRequest('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
  } catch (error) {
    showRequestError(error);
    return;
  }

  document.getElementById('extractResult').classList.remove('hidden');
  document.getElementById('fName').value = data.extracted.name;
  document.getElementById('fRequirement').value = data.extracted.requirement;
  document.getElementById('fStatus').value = data.extracted.status;

  chatSlots = data.slots;
  chatSelectedSlot = null;
  document.getElementById('bookBtn').disabled = true;
  renderSlots(document.getElementById('slotsBox'), chatSlots, (slot) => {
    chatSelectedSlot = slot;
    document.getElementById('bookBtn').disabled = false;
  });
});

document.getElementById('bookBtn').addEventListener('click', async () => {
  if (!chatSelectedSlot) return;
  const payload = {
    name: document.getElementById('fName').value,
    requirement: document.getElementById('fRequirement').value,
    status: document.getElementById('fStatus').value,
    rawMessage: chatRawMessage,
    slot: chatSelectedSlot,
  };
  let data;
  try {
    data = await apiRequest('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    showRequestError(error);
    return;
  }
  const box = document.getElementById('bookResult');
  box.classList.remove('hidden');
  box.innerHTML = `<h3>✅ Booking Confirmed</h3>
    <p><b>${data.contact.name}</b> — ${data.lead.requirement}
    (<span class="status-badge status-${data.lead.status}">${data.lead.status}</span>)</p>
    <p>Slot: ${data.appointment.slotLabel}</p>`;
  document.getElementById('bookBtn').disabled = true;
});

// ===================== TAB 2: Voice Demo =====================
let recognition = null;
let voiceSlots = [];
let voiceSelectedSlot = null;
let voiceRawMessage = '';
let isListening = false; // guards against double .start() calls
let lastError = null;    // lets onend know not to overwrite an error message

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatus = document.getElementById('voiceStatus');

if (!SpeechRecognition) {
  voiceStatus.textContent = 'Speech Recognition not supported in this browser — type the transcript manually below (Chrome recommended).';
} else {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const wave = document.getElementById('voiceWave');

  recognition.onstart = () => {
    isListening = true;
    lastError = null;
    voiceStatus.textContent = 'Listening…';
    wave.classList.add('listening');
  };
  recognition.onerror = (e) => {
    isListening = false;
    lastError = e.error;
    wave.classList.remove('listening');

    const messages = {
      'not-allowed': 'Mic permission blocked — allow microphone access for this site and try again.',
      'audio-capture': 'No microphone found — check your device settings.',
      'network': 'Speech service unreachable — this often happens in Brave (Shields) or offline. Try Chrome.',
      'no-speech': 'No speech detected — tap the mic and try again.',
    };
    voiceStatus.textContent = messages[e.error] || ('Error: ' + e.error);
  };
  recognition.onend = () => {
    isListening = false;
    wave.classList.remove('listening');
    // Don't stomp on an error message that onerror just set —
    // onend always fires right after onerror, and used to silently
    // overwrite it with "Tap the mic to speak" before the user
    // could ever read what went wrong.
    if (!lastError) {
      voiceStatus.textContent = 'Tap the mic to speak';
    }
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('voiceTranscript').value = transcript;
    voiceStatus.textContent = 'Captured — review below';
  };
}

voiceBtn.addEventListener('click', () => {
  if (!recognition) return;

  if (isListening) {
    // Already running — stop instead of calling start() again,
    // which throws InvalidStateError: "recognition has already started."
    recognition.stop();
    return;
  }

  try {
    lastError = null;
    recognition.start();
  } catch (err) {
    // Guards against any race where isListening hasn't updated yet
    console.error('Speech recognition start failed:', err);
    isListening = false;
  }
});

function speak(text) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  window.speechSynthesis.speak(utter);
}

document.getElementById('voiceExtractBtn').addEventListener('click', async () => {
  const message = document.getElementById('voiceTranscript').value;
  if (!message.trim()) return alert('No transcript yet — speak or type first.');
  voiceRawMessage = message;

  let data;
  try {
    data = await apiRequest('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
  } catch (error) {
    showRequestError(error);
    return;
  }

  document.getElementById('voiceExtractResult').classList.remove('hidden');
  document.getElementById('vName').value = data.extracted.name;
  document.getElementById('vRequirement').value = data.extracted.requirement;
  document.getElementById('vStatus').value = data.extracted.status;

  voiceSlots = data.slots;
  voiceSelectedSlot = null;

  const slotsBox = document.getElementById('voiceSlotsBox');
  const bookBtn = document.getElementById('voiceBookBtn');
  slotsBox.classList.remove('hidden');
  bookBtn.classList.remove('hidden');
  bookBtn.disabled = true;

  renderSlots(slotsBox, voiceSlots, (slot) => {
    voiceSelectedSlot = slot;
    bookBtn.disabled = false;
  });

  speak(`Got it, ${data.extracted.name}. I found ${data.slots.length} available slots. Please pick one to confirm your meeting.`);
});

document.getElementById('voiceBookBtn').addEventListener('click', async () => {
  if (!voiceSelectedSlot) return;
  const payload = {
    name: document.getElementById('vName').value,
    requirement: document.getElementById('vRequirement').value,
    status: document.getElementById('vStatus').value,
    rawMessage: voiceRawMessage,
    slot: voiceSelectedSlot,
  };
  let data;
  try {
    data = await apiRequest('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    showRequestError(error);
    return;
  }
  const box = document.getElementById('voiceBookResult');
  box.classList.remove('hidden');
  box.innerHTML = `<h3>✅ Booking Confirmed</h3>
    <p><b>${data.contact.name}</b> — ${data.lead.requirement}
    (<span class="status-badge status-${data.lead.status}">${data.lead.status}</span>)</p>
    <p>Slot: ${data.appointment.slotLabel}</p>`;
  document.getElementById('voiceBookBtn').disabled = true;
  speak(`Your meeting is confirmed for ${data.appointment.slotLabel}. Thank you!`);
});

// ===================== TAB 3: CRM Dashboard =====================
async function loadCRM() {
  let db;
  try {
    db = await apiRequest('/api/crm');
  } catch (error) {
    showRequestError(error);
    return;
  }

  const statRow = document.getElementById('statRow');
  const hotCount = db.leads.filter(l => l.status === 'Hot').length;
  statRow.innerHTML = [
    ['Contacts', db.contacts.length],
    ['Leads', db.leads.length],
    ['Hot leads', hotCount],
    ['Appointments', db.appointments.length],
  ].map(([label, value]) => `
    <div class="stat-tile">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
    </div>
  `).join('');

  const contactById = Object.fromEntries(db.contacts.map(c => [c.id, c]));

  fillTable('contactsTable', db.contacts, c => [
    c.name, new Date(c.createdAt).toLocaleString()
  ]);

  fillTable('leadsTable', db.leads, l => [
    contactById[l.contactId]?.name || '—',
    l.requirement,
    `<span class="status-badge status-${l.status}">${l.status}</span>`,
    new Date(l.createdAt).toLocaleString()
  ], true);

  fillTable('convTable', db.conversations, c => [
    contactById[c.contactId]?.name || '—',
    c.message,
    c.channel,
    new Date(c.createdAt).toLocaleString()
  ]);

  fillTable('apptTable', db.appointments, a => [
    contactById[a.contactId]?.name || '—',
    a.slotLabel,
    new Date(a.createdAt).toLocaleString()
  ]);
}

function fillTable(tableId, rows, mapFn, allowHtml) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">No records yet.</td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const cells = mapFn(row);
    tr.innerHTML = cells.map(c => `<td>${c}</td>`).join('');
    tbody.appendChild(tr);
  });
}

document.getElementById('refreshBtn').addEventListener('click', loadCRM);
document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('Reset all demo data?')) return;
  try {
    await apiRequest('/api/reset', { method: 'POST' });
    loadCRM();
  } catch (error) {
    showRequestError(error);
  }
});
