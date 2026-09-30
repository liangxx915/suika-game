const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function element() {
  const handlers = {};
  return {
    textContent: "",
    hidden: true,
    handlers,
    addEventListener(name, handler) { handlers[name] = handler; },
    getBoundingClientRect() { return { left: 0, width: 420 }; },
    getContext() { return new Proxy({}, { get: (_, key) => typeof key === "string" ? () => {} : undefined, set: () => true }); }
  };
}

const elements = Object.fromEntries(
  ["game", "next", "score", "final-score", "game-over", "restart", "play-again"].map(id => [id, element()])
);
const frames = [];
let now = 0;
const context = {
  document: { getElementById: id => elements[id] },
  performance: { now: () => now },
  requestAnimationFrame: callback => frames.push(callback),
  Math: Object.assign(Object.create(Math), { random: () => 0 }),
  Image: class {}
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../game.js"), "utf8"), context);

function advance(milliseconds) {
  const ticks = Math.ceil(milliseconds / 16.667);
  for (let i = 0; i < ticks; i++) {
    now += 16.667;
    frames.shift()(now);
  }
}

function dropAt(x) {
  elements.game.handlers.pointerdown({ clientX: x });
}

assert.equal(elements.score.textContent, "0", "新游戏得分从零开始");
dropAt(210);
advance(600);
dropAt(210);
advance(2200);
assert.ok(Number(elements.score.textContent) > 0, "两颗同类水果碰撞后应合成并加分");
elements.restart.handlers.click();
assert.equal(elements.score.textContent, "0", "重新开始应清零分数");
assert.equal(elements["game-over"].hidden, true, "重新开始应隐藏结束弹窗");
console.log("投放、合成计分和重新开始：通过");
