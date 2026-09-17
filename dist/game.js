"use strict";

// Pure game rules are also exported for dependency-free Node.js checks.
const LEVELS = { easy: { rows: 9, cols: 9, mines: 10 }, medium: { rows: 16, cols: 16, mines: 40 }, hard: { rows: 16, cols: 30, mines: 99 } };
class Minesweeper {
  constructor(level = "easy", random = Math.random) {
    Object.assign(this, LEVELS[level]);
    this.random = random;
    this.state = "ready";
    this.flags = 0;
    this.opened = 0;
    this.cells = Array.from({ length: this.rows * this.cols }, () => ({ mine: false, open: false, flag: false, count: 0 }));
  }
  neighbors(index) {
    const result = [], row = Math.floor(index / this.cols), col = index % this.cols;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const y = row + dy, x = col + dx;
      if ((dx || dy) && y >= 0 && y < this.rows && x >= 0 && x < this.cols) result.push(y * this.cols + x);
    }
    return result;
  }
  place(first) {
    const safe = new Set([first, ...this.neighbors(first)]);
    const choices = this.cells.map((_, i) => i).filter(i => !safe.has(i));
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    choices.slice(0, this.mines).forEach(i => { this.cells[i].mine = true; });
    this.cells.forEach((cell, i) => { cell.count = this.neighbors(i).filter(n => this.cells[n].mine).length; });
    this.state = "playing";
  }
  toggleFlag(index) {
    const cell = this.cells[index];
    if (!cell || cell.open || this.finished || (!cell.flag && this.flags >= this.mines)) return;
    cell.flag = !cell.flag;
    this.flags += cell.flag ? 1 : -1;
  }
  get finished() { return this.state === "won" || this.state === "lost"; }
  chord(index) {
    const cell = this.cells[index];
    if (!cell || !cell.open || !cell.count || this.finished) return;
    const neighbors = this.neighbors(index);
    if (neighbors.filter(i => this.cells[i].flag).length !== cell.count) return;
    for (const i of neighbors) {
      this.reveal(i);
      if (this.finished) break;
    }
  }
  reveal(index) {
    const cell = this.cells[index];
    if (!cell || cell.open || cell.flag || this.finished) return;
    if (this.state === "ready") this.place(index);
    if (cell.mine) { cell.open = true; this.exploded = index; this.state = "lost"; return; }
    const pending = [index];
    while (pending.length) {
      const i = pending.pop(), current = this.cells[i];
      if (current.open || current.flag || current.mine) continue;
      current.open = true;
      this.opened++;
      if (!current.count) pending.push(...this.neighbors(i));
    }
    if (this.opened === this.cells.length - this.mines) {
      this.state = "won";
      this.cells.forEach(c => { if (c.mine) c.flag = true; });
      this.flags = this.mines;
    }
  }
}
if (typeof module !== "undefined") module.exports = { Minesweeper, LEVELS };

if (typeof document !== "undefined") {
  const board = document.querySelector("#board"), status = document.querySelector("#status");
  const timer = document.querySelector("#timer"), remaining = document.querySelector("#remaining");
  const modeButton = document.querySelector("#flag-mode");
  let game, level = "easy", flagMode = false, interval = null, startedAt = 0;
  function stopTimer() { clearInterval(interval); interval = null; }
  function updateTime() { timer.textContent = String(Math.floor((Date.now() - startedAt) / 1000)).padStart(3, "0"); }
  function draw() {
    remaining.textContent = String(game.mines - game.flags).padStart(3, "0");
    document.querySelector(".game").classList.toggle("won", game.state === "won");
    document.querySelector(".game").classList.toggle("lost", game.state === "lost");
    game.cells.forEach((cell, i) => {
      const button = board.children[i], visibleMine = cell.mine && game.state === "lost";
      button.className = "cell";
      if (cell.open) button.classList.add("revealed");
      if (cell.flag) button.classList.add("flagged");
      if (visibleMine) button.classList.add("mine");
      if (game.exploded === i) button.classList.add("exploded");
      const wrong = game.state === "lost" && cell.flag && !cell.mine;
      if (wrong) button.classList.add("wrong");
      button.textContent = wrong ? "×" : visibleMine ? "✳" : cell.flag ? "⚑" : cell.open && cell.count ? cell.count : "";
      button.dataset.count = cell.open && !cell.mine ? cell.count : "";
      const label = wrong ? "잘못 표시한 깃발" : visibleMine ? "지뢰" : cell.flag ? "깃발" : cell.open ? `주변 지뢰 ${cell.count}개` : "닫힌 칸";
      button.setAttribute("aria-label", `${Math.floor(i / game.cols) + 1}행 ${i % game.cols + 1}열, ${label}`);
      button.disabled = game.finished;
    });
    document.querySelector("#emblem").textContent = game.state === "won" ? "✓" : game.state === "lost" ? "×" : "✳";
    if (game.finished) {
      stopTimer();
      status.textContent = game.state === "won" ? `성공! ${timer.textContent}초 만에 모든 안전한 칸을 찾았어요.` : "앗, 지뢰예요! 새 게임으로 다시 도전해 보세요.";
    } else status.textContent = game.state === "ready" ? "아무 칸이나 눌러 시작하세요. 첫 클릭은 안전해요." : "숫자는 주변 8칸의 지뢰 개수예요. 차근차근 찾아보세요.";
  }
  function reset() {
    stopTimer(); timer.textContent = "000"; game = new Minesweeper(level);
    flagMode = false; modeButton.setAttribute("aria-pressed", "false"); document.querySelector("#flag-label").textContent = "OFF";
    board.style.setProperty("--cols", game.cols); board.dataset.level = level;
    board.replaceChildren(...game.cells.map((_, i) => {
      const button = document.createElement("button"); button.type = "button"; button.dataset.index = i; return button;
    }));
    board.parentElement.scrollLeft = 0; draw();
  }
  function act(index, flag) {
    const wasReady = game.state === "ready";
    if (!flag && game.cells[index]?.open) game.chord(index);
    else if (flag) game.toggleFlag(index);
    else game.reveal(index);
    if (wasReady && game.state !== "ready") {
      startedAt = Date.now();
      if (!game.finished) interval = setInterval(updateTime, 250);
    }
    draw();
  }
  board.addEventListener("click", event => { const cell = event.target.closest("button"); if (cell) act(Number(cell.dataset.index), flagMode); });
  board.addEventListener("contextmenu", event => { event.preventDefault(); const cell = event.target.closest("button"); if (cell) act(Number(cell.dataset.index), true); });
  board.addEventListener("keydown", event => {
    const cell = event.target.closest("button"); if (!cell) return;
    const i = Number(cell.dataset.index), row = Math.floor(i / game.cols), col = i % game.cols;
    let next = i;
    if (event.key === "ArrowRight") next = row * game.cols + Math.min(col + 1, game.cols - 1);
    else if (event.key === "ArrowLeft") next = row * game.cols + Math.max(col - 1, 0);
    else if (event.key === "ArrowDown") next = Math.min(row + 1, game.rows - 1) * game.cols + col;
    else if (event.key === "ArrowUp") next = Math.max(row - 1, 0) * game.cols + col;
    else if (event.key.toLowerCase() === "f") { event.preventDefault(); act(i, true); return; }
    else return;
    event.preventDefault(); board.children[next].focus();
  });
  modeButton.addEventListener("click", () => { flagMode = !flagMode; modeButton.setAttribute("aria-pressed", String(flagMode)); document.querySelector("#flag-label").textContent = flagMode ? "ON" : "OFF"; });
  document.querySelector("#restart").addEventListener("click", reset);
  document.querySelectorAll("[data-level]").forEach(button => {
    if (button === board) return;
    button.addEventListener("click", () => {
      level = button.dataset.level;
      document.querySelectorAll(".levels button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      reset();
    });
  });
  reset();
}
