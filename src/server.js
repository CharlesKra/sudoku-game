const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'sudoku-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
    const br = 3 * Math.floor(row / 3) + Math.floor(i / 3);
    const bc = 3 * Math.floor(col / 3) + (i % 3);
    if (board[br][bc] === num) return false;
  }
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function solve(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        for (const n of shuffle([1,2,3,4,5,6,7,8,9])) {
          if (isValid(board, r, c, n)) {
            board[r][c] = n;
            if (solve(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generatePuzzle(difficulty) {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  solve(solution);
  const puzzle = solution.map(r => [...r]);
  const remove = difficulty === 'easy' ? 35 : difficulty === 'medium' ? 45 : 55;
  let removed = 0;
  while (removed < remove) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== 0) { puzzle[r][c] = 0; removed++; }
  }
  return { puzzle, solution };
}

const leaderboard = [];

app.post('/api/game/new', (req, res) => {
  const { difficulty = 'medium', playerName = 'Anonymous' } = req.body;
  const { puzzle, solution } = generatePuzzle(difficulty);
  req.session.game = { puzzle, solution, current: puzzle.map(r => [...r]), difficulty, playerName, startTime: Date.now(), hints: 0, moves: 0 };
  res.json({ puzzle, difficulty, playerName });
});

app.get('/api/game/state', (req, res) => {
  if (!req.session.game) return res.status(404).json({ error: 'No active game' });
  const { current, puzzle, difficulty, hints, moves, startTime, playerName } = req.session.game;
  res.json({ current, puzzle, difficulty, hints, moves, playerName, elapsed: Math.floor((Date.now() - startTime) / 1000) });
});

app.post('/api/game/move', (req, res) => {
  if (!req.session.game) return res.status(404).json({ error: 'No active game' });
  const { row, col, value } = req.body;
  const { game } = req.session;
  if (game.puzzle[row][col] !== 0) return res.status(400).json({ error: 'Cannot modify a given cell' });
  game.current[row][col] = value;
  game.moves++;
  const correct = value === 0 || value === game.solution[row][col];
  const solved = game.current.every((r, ri) => r.every((v, ci) => v === game.solution[ri][ci]));
  if (solved) {
    const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
    const score = Math.max(1000 - elapsed - game.hints * 30, 100);
    leaderboard.push({ name: game.playerName, difficulty: game.difficulty, time: elapsed, hints: game.hints, score, date: new Date().toISOString() });
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > 50) leaderboard.length = 50;
    req.session.game = null;
    return res.json({ correct: true, solved: true, score, elapsed });
  }
  res.json({ correct, solved: false });
});

app.get('/api/game/hint', (req, res) => {
  if (!req.session.game) return res.status(404).json({ error: 'No active game' });
  const { game } = req.session;
  const empty = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (game.current[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return res.json({ message: 'Board is complete' });
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  game.hints++;
  res.json({ row: r, col: c, value: game.solution[r][c] });
});

app.get('/api/game/validate', (req, res) => {
  if (!req.session.game) return res.status(404).json({ error: 'No active game' });
  const { current, solution } = req.session.game;
  const errors = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (current[r][c] !== 0 && current[r][c] !== solution[r][c])
        errors.push({ row: r, col: c });
  res.json({ errors, valid: errors.length === 0 });
});

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard.slice(0, 10));
});

app.listen(PORT, () => console.log(`Sudoku server running on port ${PORT}`));
