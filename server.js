const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
  const clues = difficulty === 'easy' ? 46 : difficulty === 'medium' ? 36 : 26;
  const toRemove = 81 - clues;
  let removed = 0;
  while (removed < toRemove) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== 0) { puzzle[r][c] = 0; removed++; }
  }
  return { puzzle, solution };
}

const leaderboard = [];

app.get('/api/puzzle', (req, res) => {
  const difficulty = req.query.difficulty || 'medium';
  const { puzzle, solution } = generatePuzzle(difficulty);
  res.json({ puzzle, solution, difficulty });
});

app.post('/api/validate', (req, res) => {
  const { board, solution } = req.body;
  if (!board || !solution) return res.status(400).json({ error: 'Missing board or solution' });
  const errors = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] !== 0 && board[r][c] !== solution[r][c])
        errors.push({ row: r, col: c });
  const filled = board.flat().filter(v => v !== 0).length;
  const solved = filled === 81 && errors.length === 0;
  res.json({ errors, solved });
});

app.post('/api/hint', (req, res) => {
  const { board, solution } = req.body;
  const empty = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0) empty.push({ r, c });
  if (empty.length === 0) return res.json({ hint: null });
  const { r, c } = empty[Math.floor(Math.random() * empty.length)];
  res.json({ hint: { row: r, col: c, value: solution[r][c] } });
});

app.get('/api/leaderboard', (req, res) => {
  const top = [...leaderboard].sort((a, b) => a.time - b.time).slice(0, 10);
  res.json(top);
});

app.post('/api/leaderboard', (req, res) => {
  const { name, time, difficulty } = req.body;
  if (!name || !time || !difficulty) return res.status(400).json({ error: 'Missing fields' });
  const entry = { name: name.slice(0, 20), time, difficulty, date: new Date().toISOString() };
  leaderboard.push(entry);
  res.json({ success: true, entry });
});

app.listen(PORT, () => console.log(`Sudoku server running on port ${PORT}`));
