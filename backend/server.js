// backend/server.js
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken'); // npm i jsonwebtoken

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store
let participants = []; // { id, twitchId, name, score }

// Verify Twitch Extension JWT
function verifyExtJWT(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, process.env.EXT_SECRET, { algorithms: ['HS256'] });
    req.twitch = payload; // { channel_id, opaque_user_id, user_id?, ... }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Helix app token (client credentials)
let appToken = { token: null, expiresAt: 0 };
async function getAppAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (appToken.token && appToken.expiresAt - 60 > now) return appToken.token;

  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      `client_id=${encodeURIComponent(process.env.TWITCH_CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(process.env.TWITCH_CLIENT_SECRET)}` +
      `&grant_type=client_credentials`
  });
  if (!resp.ok) throw new Error('Failed to obtain app access token');
  const data = await resp.json();
  appToken = { token: data.access_token, expiresAt: Math.floor(Date.now()/1000) + (data.expires_in || 3600) };
  return appToken.token;
}

async function getDisplayName(userId) {
  if (!userId) return null;
  const token = await getAppAccessToken();
  const resp = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.data && json.data[0] ? json.data[0].display_name : null;
}

// Routes
app.get('/', (req, res) => res.send('Leaderboard backend is running'));

// Public leaderboard
app.get('/leaderboard', (req, res) => {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  res.json(sorted);
});

// Create/find player — uses Twitch identity when available
app.post('/player', verifyExtJWT, async (req, res) => {
  const { user_id, opaque_user_id } = req.twitch || {};
  const twitchId = user_id || opaque_user_id;
  if (!twitchId) return res.status(400).json({ error: 'No Twitch identity' });

  let displayName = null;
  if (user_id) {
    try { displayName = await getDisplayName(user_id); } catch {}
  }
  if (!displayName) {
    const bodyName = (req.body && typeof req.body.name === 'string' && req.body.name.trim()) || null;
    displayName = bodyName || `Viewer-${twitchId.slice(-6)}`;
  }

  let existing = participants.find(p => p.twitchId === twitchId);
  if (existing) {
    if (displayName && existing.name !== displayName) existing.name = displayName;
    return res.json(existing);
  }

  const created = { id: uuidv4(), twitchId, name: displayName, score: 0 };
  participants.push(created);
  res.json(created);
});

// Increment score (auth required)
app.post('/score', verifyExtJWT, (req, res) => {
  const { id, inc } = req.body;
  const participant = participants.find(p => p.id === id);
  if (!participant) return res.status(404).json({ error: 'Participant not found' });

  const increment = Number.isInteger(inc) && inc > 0 ? inc : 1;
  participant.score += increment;
  res.json(participant);
});

// Optional: reset
app.post('/reset', verifyExtJWT, (req, res) => {
  const { id } = req.body;
  const participant = participants.find(p => p.id === id);
  if (!participant) return res.status(404).json({ error: 'Participant not found' });
  participant.score = 0;
  res.json(participant);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Leaderboard backend listening on ${PORT}`));
