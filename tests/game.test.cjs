const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Minesweeper, LEVELS } = require('../dist/game.js');

for (const level of Object.keys(LEVELS)) {
  test(`${level}: safe opening, exact mine counts and consistent neighbor numbers`, () => {
    for (let seed = 1; seed <= 20; seed++) {
      let value = seed;
      const game = new Minesweeper(level, () => ((value = (value * 16807) % 2147483647) - 1) / 2147483646);
      const first = seed % game.cells.length;
      game.reveal(first);
      assert.equal(game.cells.filter(c => c.mine).length, game.mines);
      assert.ok([first, ...game.neighbors(first)].every(i => !game.cells[i].mine));
      assert.ok(game.opened > 1);
      game.cells.forEach((c, i) => assert.equal(c.count, game.neighbors(i).filter(n => game.cells[n].mine).length));
      for (let i = 0; i < game.cells.length; i++) if (!game.cells[i].mine) game.reveal(i);
      assert.equal(game.state, 'won');
      assert.equal(game.flags, game.mines);
    }
  });
}
test('flags prevent opening and are limited; removing flags allows opening', () => {
  const game = new Minesweeper();
  for (let i = 0; i <= game.mines; i++) game.toggleFlag(i);
  assert.equal(game.flags, game.mines);
  game.reveal(0); assert.equal(game.state, 'ready');
  game.toggleFlag(0); game.reveal(0);
  assert.ok(game.cells[0].open);
  game.toggleFlag(0); assert.equal(game.cells[0].flag, false);
});
test('hitting a mine ends the game and prevents further actions', () => {
  const game = new Minesweeper(); game.reveal(40);
  const mine = game.cells.findIndex(c => c.mine); game.reveal(mine);
  assert.equal(game.state, 'lost'); assert.equal(game.exploded, mine);
  const before = JSON.stringify(game.cells);
  game.cells.forEach((_, i) => { game.reveal(i); game.toggleFlag(i); });
  assert.equal(JSON.stringify(game.cells), before);
});

function chordBoard() {
  const game = new Minesweeper();
  game.rows = 3; game.cols = 3; game.mines = 1;
  game.cells = game.cells.slice(0, 9);
  game.cells[0].mine = true;
  game.cells.forEach((cell, i) => { cell.count = game.neighbors(i).filter(n => game.cells[n].mine).length; });
  game.state = 'playing';
  game.reveal(4);
  return game;
}

test('chording a number with correct flags opens neighbors and can win', () => {
  const game = chordBoard();
  game.toggleFlag(0); game.chord(4);
  assert.equal(game.state, 'won');
  assert.equal(game.opened, 8);
  assert.ok(game.cells[0].flag && !game.cells[0].open);
  assert.ok(game.cells.slice(1).every(c => c.open));
});

test('chording does nothing when flag count is too low or too high', () => {
  const game = chordBoard();
  game.chord(4); assert.equal(game.opened, 1);
  game.mines = 2;
  game.toggleFlag(0); game.toggleFlag(1);
  const before = JSON.stringify(game.cells);
  game.chord(4); assert.equal(JSON.stringify(game.cells), before);
});

test('matching flag count with a misplaced flag exposes a mine and loses', () => {
  const game = chordBoard();
  game.toggleFlag(1); game.chord(4);
  assert.equal(game.state, 'lost');
  assert.equal(game.exploded, 0);
  assert.equal(game.cells[1].open, false);
  const before = JSON.stringify(game.cells);
  game.chord(4); assert.equal(JSON.stringify(game.cells), before);
});

test('chording a closed cell does not open it', () => {
  const game = chordBoard(); game.toggleFlag(0);
  const before = JSON.stringify(game.cells);
  game.chord(1); assert.equal(JSON.stringify(game.cells), before);
});
