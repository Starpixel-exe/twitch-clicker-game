// backend/server.js
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store (for production, use a DB)
let participants = []; // { id, name, score }

app.get('/', (req, res) => {
  res.send('Leaderboard backend is running');
});

// GET /leaderboard -> sorted high to low
app.get('/leaderboard', (req, res) => {
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  res.json(sorted);
});

// POST /player { name } -> find or create participant
app.post('/player', (req, res) => {
  let { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }
  name = name.trim();
  let existing = participants.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return res.json(existing);

  const newP = { id: uuidv4(), name, score: 0 };
  participants.push(newP);
  res.json(newP);
});

// POST /score { id, inc? } -> increment participant's score by inc (default 1)
app.post('/score', (req, res) => {
  const { id, inc } = req.body;
  const participant = participants.find(p => p.id === id);
  if (!participant) return res.status(404).json({ error: 'Participant not found' });

  const increment = Number.isInteger(inc) && inc > 0 ? inc : 1;
  participant.score += increment;
  res.json(participant);
});

// (Optional) POST /reset { id } -> set participant score to 0
app.post('/reset', (req, res) => {
  const { id } = req.body;
  const participant = participants.find(p => p.id === id);
  if (!participant) return res.status(404).json({ error: 'Participant not found' });
  participant.score = 0;
  res.json(participant);
});

// Render provides PORT; default to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Leaderboard backend listening on port ${PORT}`);
});
