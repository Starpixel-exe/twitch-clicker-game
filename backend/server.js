/*
 * Simple leaderboard backend for the "Feed Me!" clicker game. This server
 * exposes a tiny REST API for managing a shared leaderboard. It stores
 * participant data in memory (name, id and score). In a production setting
 * you should back this with a persistent data store (for example
 * PostgreSQL, Redis, or another database) to ensure scores are not lost
 * when the server restarts.
 *
 * Endpoints:
 *  GET  /leaderboard
 *      → returns an array of participants sorted by score (descending).
 *  POST /player
 *      → body: { name: string }
 *      → returns: { id, name, score }
 *      Adds a new participant if the name does not exist, otherwise returns
 *      the existing participant.
 *  POST /score
 *      → body: { id: string }
 *      → increments the participant's score by 1 and returns the updated
 *      participant.
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data store for participants
const participants = [];

// GET /leaderboard
app.get('/leaderboard', (req, res) => {
  // Return sorted copy to avoid mutating the original array
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  res.json(sorted);
});

// POST /player
// Adds a participant if not already present; returns existing participant
app.post('/player', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }
  // Check if participant already exists (case insensitive)
  const existing = participants.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return res.json(existing);
  }
  const newParticipant = { id: uuidv4(), name, score: 0 };
  participants.push(newParticipant);
  res.json(newParticipant);
});

// POST /score
// Increments a participant's score by the specified amount (default 1).
// Body: { id: string, inc?: number }
app.post('/score', (req, res) => {
  const { id, inc } = req.body;
  const participant = participants.find(p => p.id === id);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }
  // Ensure inc is a positive integer; default to 1
  const increment = Number.isInteger(inc) && inc > 0 ? inc : 1;
  participant.score += increment;
  res.json(participant);
});

// POST /reset
// Resets a participant's score to zero.
// Body: { id: string }
app.post('/reset', (req, res) => {
  const { id } = req.body;
  const participant = participants.find(p => p.id === id);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }
  participant.score = 0;
  res.json(participant);
});

// Root route provides a simple message
app.get('/', (req, res) => {
  res.send('Leaderboard backend is running');
});

app.listen(port, () => {
  console.log(`Leaderboard backend listening on port ${port}`);
});