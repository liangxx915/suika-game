(() => {
  "use strict";

  // 奶蛙素材放在 assets/naiwa；每个等级仍使用原有半径与合成分数。
  // 十一种表情对应十一个等级，图片加载失败时保留 Canvas 水果画法。
  const FRUITS = [
    { name: "樱桃", radius: 17, color: "#ed6968", points: 1, image: "./assets/naiwa/neutral.png" },
    { name: "草莓", radius: 21, color: "#f27d86", points: 3, image: "./assets/naiwa/downcast.png" },
    { name: "葡萄", radius: 25, color: "#ab83c8", points: 6, image: "./assets/naiwa/thinking.png" },
    { name: "橘子", radius: 30, color: "#ffad57", points: 10, image: "./assets/naiwa/laugh-close.png" },
    { name: "柿子", radius: 35, color: "#f18a58", points: 15, image: "./assets/naiwa/tongue-foot.png" },
    { name: "苹果", radius: 41, color: "#dc6d5d", points: 21, image: "./assets/naiwa/peace.png" },
    { name: "梨子", radius: 47, color: "#c4d979", points: 28, image: "./assets/naiwa/cat-paws.png" },
    { name: "桃子", radius: 54, color: "#f5aaa1", points: 36, image: "./assets/naiwa/bend.png" },
    { name: "菠萝", radius: 61, color: "#e9c35d", points: 45, image: "./assets/naiwa/headstand.png" },
    { name: "椰子", radius: 69, color: "#b99a74", points: 55, image: "./assets/naiwa/laugh-head.png" },
    { name: "西瓜", radius: 77, color: "#75b86d", points: 66, image: "./assets/naiwa/laugh-open.png" }
  ];
  const WIDTH = 420;
  const HEIGHT = 610;
  const TOP_LINE = 92;
  const FLOOR = HEIGHT - 8;
  const GRAVITY = 1250;
  const STEP = 1 / 60;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const nextCanvas = document.getElementById("next");
  const nextCtx = nextCanvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const finalScoreEl = document.getElementById("final-score");
  const overlay = document.getElementById("game-over");
  const images = FRUITS.map(fruit => {
    if (!fruit.image) return null;
    const image = new Image();
    image.src = fruit.image;
    return image;
  });

  let fruits = [];
  let score = 0;
  let nextTier = randomTier();
  let aimX = WIDTH / 2;
  let lastDrop = -Infinity;
  let dangerTime = 0;
  let gameOver = false;
  let lastFrame = 0;
  let accumulator = 0;
  let nextId = 1;
  let activePointerId = null;

  function randomTier() { return Math.floor(Math.random() * 5); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function newFruit(tier, x, y, vx = 0, vy = 0) {
    return { id: nextId++, tier, x, y, vx, vy, age: 0 };
  }

  function reset() {
    clearPointer();
    fruits = [];
    score = 0;
    nextTier = randomTier();
    aimX = WIDTH / 2;
    lastDrop = -Infinity;
    dangerTime = 0;
    gameOver = false;
    accumulator = 0;
    scoreEl.textContent = "0";
    overlay.hidden = true;
    drawNext();
  }

  function drop() {
    if (gameOver || performance.now() - lastDrop < 450) return;
    const radius = FRUITS[nextTier].radius;
    fruits.push(newFruit(nextTier, clamp(aimX, radius + 4, WIDTH - radius - 4), 43));
    lastDrop = performance.now();
    nextTier = randomTier();
    drawNext();
  }

  function resolveBounds(body) {
    const r = FRUITS[body.tier].radius;
    if (body.x < r + 4) { body.x = r + 4; body.vx = Math.max(0, -body.vx * 0.22); }
    if (body.x > WIDTH - r - 4) { body.x = WIDTH - r - 4; body.vx = Math.min(0, -body.vx * 0.22); }
    if (body.y > FLOOR - r) {
      body.y = FLOOR - r;
      body.vy = Math.min(0, -body.vy * 0.12);
      body.vx *= 0.97;
    }
  }

  function physicsStep() {
    for (const body of fruits) {
      body.age += STEP;
      body.vy += GRAVITY * STEP;
      body.vx *= 0.998;
      body.x += body.vx * STEP;
      body.y += body.vy * STEP;
    }

    const mergePairs = [];
    const claimed = new Set();
    for (let iteration = 0; iteration < 5; iteration++) {
      for (const body of fruits) resolveBounds(body);

      for (let i = 0; i < fruits.length; i++) {
        const a = fruits[i];
        for (let j = i + 1; j < fruits.length; j++) {
          const b = fruits[j];
          if (claimed.has(a.id) || claimed.has(b.id)) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minDist = FRUITS[a.tier].radius + FRUITS[b.tier].radius;
          const distSq = dx * dx + dy * dy;
          if (distSq >= minDist * minDist) continue;
          if (a.tier === b.tier && a.tier < FRUITS.length - 1 && !claimed.has(a.id) && !claimed.has(b.id)) {
            claimed.add(a.id);
            claimed.add(b.id);
            mergePairs.push([a, b]);
            continue;
          }

          const distance = Math.sqrt(distSq);
          const nx = distance > 0.0001 ? dx / distance : 1;
          const ny = distance > 0.0001 ? dy / distance : 0;
          const overlap = minDist - distance;
          const massA = FRUITS[a.tier].radius ** 2;
          const massB = FRUITS[b.tier].radius ** 2;
          const total = massA + massB;
          a.x -= nx * overlap * (massB / total);
          a.y -= ny * overlap * (massB / total);
          b.x += nx * overlap * (massA / total);
          b.y += ny * overlap * (massA / total);

          const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (relative < 0) {
            const impulse = -(1 + 0.12) * relative / (1 / massA + 1 / massB);
            a.vx -= (impulse / massA) * nx;
            a.vy -= (impulse / massA) * ny;
            b.vx += (impulse / massB) * nx;
            b.vy += (impulse / massB) * ny;
          }
        }
      }
    }
    for (const body of fruits) if (!claimed.has(body.id)) resolveBounds(body);

    if (mergePairs.length) {
      const removed = new Set(mergePairs.flatMap(pair => pair.map(body => body.id)));
      fruits = fruits.filter(body => !removed.has(body.id));
      for (const [a, b] of mergePairs) {
        const tier = a.tier + 1;
        const radius = FRUITS[tier].radius;
        fruits.push(newFruit(
          tier,
          clamp((a.x + b.x) / 2, radius + 4, WIDTH - radius - 4),
          Math.min((a.y + b.y) / 2, FLOOR - radius),
          (a.vx + b.vx) / 2,
          Math.min((a.vy + b.vy) / 2, 80)
        ));
        score += FRUITS[tier].points;
      }
      scoreEl.textContent = String(score);
    }

    const crowded = fruits.some(body => body.age > 2 && body.y - FRUITS[body.tier].radius < TOP_LINE);
    dangerTime = crowded ? dangerTime + STEP : 0;
    if (dangerTime > 2) {
      gameOver = true;
      finalScoreEl.textContent = String(score);
      overlay.hidden = false;
    }
  }

  function drawFruit(target, tier, x, y, radius, alpha = 1) {
    const fruit = FRUITS[tier];
    const image = images[tier];
    target.save();
    target.globalAlpha = alpha;
    target.translate(x, y);
    if (image && image.complete && image.naturalWidth) {
      target.beginPath();
      target.arc(0, 0, radius - 1, 0, Math.PI * 2);
      target.fillStyle = "#fff7dc";
      target.fill();
      target.clip();
      const size = radius * 1.82;
      target.drawImage(image, -size / 2, -size / 2, size, size);
      target.beginPath();
      target.arc(0, 0, radius - 1, 0, Math.PI * 2);
      target.strokeStyle = fruit.color;
      target.lineWidth = Math.max(1.5, radius * 0.07);
      target.stroke();
      target.restore();
      return;
    }
    target.fillStyle = "#334e3b24";
    target.beginPath();
    target.ellipse(2, radius * 0.88, radius * 0.86, radius * 0.2, 0, 0, Math.PI * 2);
    target.fill();
    target.fillStyle = fruit.color;
    target.strokeStyle = "#43644355";
    target.lineWidth = Math.max(1.5, radius * 0.07);
    target.beginPath();
    target.arc(0, 0, radius - 1, 0, Math.PI * 2);
    target.fill();
    target.stroke();
    target.fillStyle = "#ffffff66";
    target.beginPath();
    target.ellipse(-radius * 0.33, -radius * 0.38, radius * 0.24, radius * 0.13, -0.6, 0, Math.PI * 2);
    target.fill();
    if (tier === 10) {
      target.strokeStyle = "#397d4a88";
      target.lineWidth = 2;
      for (let offset = -0.55; offset <= 0.55; offset += 0.55) {
        target.beginPath();
        target.ellipse(offset * radius, 0, radius * 0.22, radius * 0.9, 0, -Math.PI / 2, Math.PI / 2);
        target.stroke();
      }
    }
    target.fillStyle = "#2b4938";
    const eye = Math.max(2, radius * 0.075);
    target.beginPath();
    target.arc(-radius * 0.25, radius * 0.05, eye, 0, Math.PI * 2);
    target.arc(radius * 0.25, radius * 0.05, eye, 0, Math.PI * 2);
    target.fill();
    target.strokeStyle = "#2b4938";
    target.lineWidth = Math.max(1.5, radius * 0.045);
    target.beginPath();
    target.arc(0, radius * 0.11, radius * 0.14, 0.13, Math.PI - 0.13);
    target.stroke();
    if (radius >= 28) {
      target.fillStyle = "#e8797d77";
      target.beginPath();
      target.arc(-radius * 0.48, radius * 0.18, radius * 0.09, 0, Math.PI * 2);
      target.arc(radius * 0.48, radius * 0.18, radius * 0.09, 0, Math.PI * 2);
      target.fill();
    }
    target.fillStyle = "#57945a";
    target.beginPath();
    target.ellipse(radius * 0.11, -radius * 0.9, radius * 0.22, radius * 0.1, -0.45, 0, Math.PI * 2);
    target.fill();
    target.restore();
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, 64, 64);
    drawFruit(nextCtx, nextTier, 32, 32, 22);
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#fffdf3";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = dangerTime > 0 ? "#e8897e" : "#d9d7b4";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(8, TOP_LINE);
    ctx.lineTo(WIDTH - 8, TOP_LINE);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = dangerTime > 0 ? "#d96761" : "#acaf8d";
    ctx.font = "bold 12px 'Trebuchet MS', 'Microsoft YaHei', sans-serif";
    ctx.fillText("警戒线", 13, TOP_LINE - 10);
    ctx.fillStyle = "#e5edc9";
    ctx.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);
    for (const body of fruits) drawFruit(ctx, body.tier, body.x, body.y, FRUITS[body.tier].radius);
    if (!gameOver) {
      const r = FRUITS[nextTier].radius;
      const x = clamp(aimX, r + 4, WIDTH - r - 4);
      ctx.strokeStyle = "#9eb89a88";
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.lineTo(x, TOP_LINE - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      drawFruit(ctx, nextTier, x, 43, r, 0.75);
    }
  }

  function frame(time) {
    if (!lastFrame) lastFrame = time;
    accumulator += Math.min((time - lastFrame) / 1000, 0.05);
    lastFrame = time;
    while (accumulator >= STEP) {
      if (!gameOver) physicsStep();
      accumulator -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }

  function aimAt(event) {
    const bounds = canvas.getBoundingClientRect();
    aimX = (event.clientX - bounds.left) * WIDTH / bounds.width;
  }

  function clearPointer() {
    if (activePointerId === null) return;
    const pointerId = activePointerId;
    activePointerId = null;
    if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
  }

  canvas.addEventListener("pointermove", event => {
    if (activePointerId === event.pointerId || (activePointerId === null && event.pointerType === "mouse")) aimAt(event);
  });
  canvas.addEventListener("pointerdown", event => {
    if (gameOver || activePointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    activePointerId = event.pointerId;
    aimAt(event);
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointerup", event => {
    if (event.pointerId !== activePointerId) return;
    aimAt(event);
    clearPointer();
    drop();
  });
  canvas.addEventListener("pointercancel", event => {
    if (event.pointerId === activePointerId) clearPointer();
  });
  canvas.addEventListener("lostpointercapture", event => {
    if (event.pointerId === activePointerId) activePointerId = null;
  });
  document.getElementById("restart").addEventListener("click", reset);
  document.getElementById("play-again").addEventListener("click", reset);
  reset();
  requestAnimationFrame(frame);
})();
