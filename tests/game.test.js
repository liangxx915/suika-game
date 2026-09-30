const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createGame() {
  function element() {
    const handlers = {};
    let capturedPointer = null;
    return {
      textContent: "",
      hidden: true,
      handlers,
      boundsWidth: 420,
      addEventListener(name, handler) { handlers[name] = handler; },
      getBoundingClientRect() { return { left: 0, width: this.boundsWidth }; },
      setPointerCapture(id) { capturedPointer = id; },
      hasPointerCapture(id) { return capturedPointer === id; },
      releasePointerCapture(id) { if (capturedPointer === id) capturedPointer = null; },
      getContext() {
        return new Proxy({}, {
          get: (_, key) => typeof key === "string" ? () => {} : undefined,
          set: () => true
        });
      }
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

  const source = fs.readFileSync(path.join(__dirname, "../game.js"), "utf8");
  assert.match(source, /\}\)\(\);\s*$/, "测试需要在游戏闭包结尾注入只读状态接口");
  const instrumented = source.replace(/\}\)\(\);\s*$/, `
    globalThis.__test = {
      snapshot: () => ({
        fruits: fruits.map(body => ({ ...body })), score, dangerTime, gameOver, activePointerId
      }),
      seed: entries => { fruits = entries.map(entry => ({
        ...newFruit(entry.tier, entry.x, entry.y, entry.vx || 0, entry.vy || 0),
        age: entry.age || 0
      })); },
      setDangerTime: value => { dangerTime = value; },
      step: physicsStep
    };
  })();`);
  vm.runInNewContext(instrumented, context);

  function event(x, pointerId = 1, pointerType = "touch") {
    return { clientX: x, pointerId, pointerType, button: 0 };
  }
  function send(type, x, pointerId = 1, pointerType = "touch") {
    elements.game.handlers[type](event(x, pointerId, pointerType));
  }
  function tap(x, pointerId = 1) {
    send("pointerdown", x, pointerId);
    send("pointerup", x, pointerId);
  }
  function advance(milliseconds) {
    const ticks = Math.ceil(milliseconds / 16.667);
    for (let i = 0; i < ticks; i++) {
      now += 16.667;
      frames.shift()(now);
    }
  }
  function reset() { elements.restart.handlers.click(); }
  return { elements, api: context.__test, send, tap, advance, reset };
}

const game = createGame();
const state = () => game.api.snapshot();
assert.equal(game.elements.score.textContent, "0", "新游戏从零分开始");

game.send("pointerdown", 210);
assert.equal(state().fruits.length, 0, "按下时只预览，不立即投放");
game.send("pointerup", 210);
assert.equal(state().fruits.length, 1, "轻点只投放一颗水果");
assert.equal(state().fruits[0].x, 210, "轻点落在触点位置");

game.reset();
game.send("pointerdown", 80);
game.send("pointermove", 320);
game.send("pointerup", 320);
assert.equal(state().fruits[0].x, 320, "拖动后按松手位置投放");

game.reset();
game.send("pointerdown", 210);
game.send("pointermove", 600);
game.send("pointerup", 600);
assert.equal(state().fruits[0].x, 399, "移出右边界时仍在棋盘内投放");

game.reset();
game.elements.game.boundsWidth = 210;
game.tap(105);
assert.equal(state().fruits[0].x, 210, "棋盘缩小时仍正确换算坐标");
game.elements.game.boundsWidth = 420;

game.reset();
game.send("pointerdown", 80, 1);
game.send("pointerdown", 330, 2);
game.send("pointerup", 330, 2);
game.send("pointercancel", 80, 1);
game.send("pointerup", 80, 1);
assert.equal(state().fruits.length, 0, "第二根手指和取消触控不投放");

game.send("pointerdown", 180);
game.reset();
game.send("pointerup", 180);
assert.equal(state().fruits.length, 0, "重开会清除正在进行的操作");

game.tap(210);
game.tap(210);
assert.equal(state().fruits.length, 1, "投放间隔内不重复生成水果");
game.advance(600);
game.tap(210);
game.advance(2200);
assert.ok(state().score > 0, "两颗同类水果碰撞后合成并加分");

game.reset();
game.api.seed([{ tier: 0, x: 210, y: 500 }, { tier: 0, x: 210, y: 500 }]);
game.api.step();
assert.equal(state().fruits.length, 1, "一次碰撞只合成一颗新水果");
assert.equal(state().fruits[0].tier, 1);
assert.equal(state().score, 3, "合成只计分一次");

game.reset();
game.api.seed([
  { tier: 0, x: 210, y: 500 },
  { tier: 0, x: 210, y: 500 },
  { tier: 1, x: 210, y: 540 }
]);
for (let i = 0; i < 120; i++) game.api.step();
assert.equal(state().score, 9, "连续合成累计两级分数");
assert.equal(state().fruits.filter(body => body.tier === 2).length, 1);

game.reset();
game.api.seed([
  { tier: 0, x: -50, y: 700 },
  { tier: 1, x: 210, y: 700 }
]);
game.api.step();
assert.ok(state().fruits[0].x >= 21 && state().fruits[0].y <= 585, "水果不会穿过左墙或地板");

game.reset();
game.api.seed([{ tier: 0, x: 500, y: 700 }]);
game.api.step();
assert.ok(state().fruits[0].x <= 399 && state().fruits[0].y <= 585, "水果不会穿过右墙或地板");

game.reset();
game.api.seed([{ tier: 0, x: 210, y: 500 }, { tier: 1, x: 210, y: 500 }]);
game.api.step();
assert.ok(state().fruits.every(body => Number.isFinite(body.x) && Number.isFinite(body.y)), "重合的不同水果不会产生无效坐标");

game.reset();
game.api.setDangerTime(1.99);
game.api.step();
assert.equal(state().dangerTime, 0, "警戒线恢复空闲时计时清零");
assert.equal(state().gameOver, false, "短暂越线不会判负");

game.reset();
game.api.seed([{ tier: 10, x: 210, y: 60, age: 3 }]);
game.api.setDangerTime(1.99);
game.api.step();
assert.equal(state().gameOver, true, "持续越线后判负");
assert.equal(game.elements["game-over"].hidden, false);
game.reset();
assert.equal(state().gameOver, false, "重开清除判负状态");
assert.equal(state().dangerTime, 0, "重开清除警戒计时");

console.log("投放、碰撞、合成、判负和重开：通过");
