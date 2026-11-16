/* Лабиринт — первая версия.
   Шарик, вид со спины, процедурный лабиринт. */
(() => {
  "use strict";

  // ---------- Настройки ----------
  const COLS = 47;            // нечётное
  const ROWS = 47;            // нечётное
  const CELL = 2;             // размер клетки в юнитах
  const WALL_H = 1.0;
  const BALL_R = 0.38;
  const MAX_SPEED = 6.6;
  const ACCEL = 26;
  const EXIT_RADIUS = 0.95;
  const PIT_RADIUS = 0.9;
  const KEY_COUNT = 3;
  const JUMP_VELOCITY = 6.0;
  const GRAVITY = 16;
  const RIVER_ROWS = [34, 35, 36];

  const CAM_DIST = 4.7;
  const CAM_HEIGHT = 2.9;
  const CAM_LOOK_AHEAD = 1.4;
  const TURN_RATE = 2.5;

  const FOG_COLOR = 0x05080e;

  // ---------- Стиль мячика ----------
  const BALL_PALETTE = [
    { color: "#ff7526", name: "Оранжевый" },
    { color: "#ffd23f", name: "Жёлтый" },
    { color: "#7bff6b", name: "Лайм" },
    { color: "#35d9ac", name: "Мята" },
    { color: "#45b7ff", name: "Голубой" },
    { color: "#7c6cff", name: "Фиолетовый" },
    { color: "#ff5fa2", name: "Розовый" },
    { color: "#ff3b3b", name: "Красный" },
    { color: "#f5f2ea", name: "Белый" },
    { color: "#b9c6d6", name: "Серебро" },
    { color: "#40506a", name: "Графит" },
    { color: "#10141c", name: "Чёрный" },
  ];

  const BALL_PATTERNS = [
    { id: "solid", label: "Гладкий" },
    { id: "stripes", label: "Полосы" },
    { id: "dots", label: "Горошек" },
    { id: "checker", label: "Клетка" },
    { id: "waves", label: "Волны" },
    { id: "segments", label: "Сегменты" },
    { id: "soccer", label: "Футбол" },
    { id: "basketball", label: "Баскетбол" },
    { id: "tennis", label: "Теннис" },
    { id: "volleyball", label: "Волейбол" },
  ];

  let ballColor = "#ff7526";
  let ballPattern = "stripes";

  (function loadBallStyle() {
    try {
      const saved = JSON.parse(localStorage.getItem("labirint.ball.v1") || "{}");
      if (typeof saved.color === "string" && /^#[0-9a-f]{6}$/i.test(saved.color)) {
        ballColor = saved.color.toLowerCase();
      }
      if (BALL_PATTERNS.some((p) => p.id === saved.pattern)) {
        ballPattern = saved.pattern;
      }
    } catch (e) {
      /* сохранение повреждено — используем стиль по умолчанию */
    }
  })();

  // ---------- DOM ----------
  const canvas = document.getElementById("scene");
  const hud = document.getElementById("hud");
  const timerEl = document.getElementById("timer");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const keyPipsEl = document.getElementById("keyPips");
  const toastEl = document.getElementById("toast");
  const previewUi = document.getElementById("preview");
  const previewLevelEl = document.getElementById("previewLevel");
  const previewCountEl = document.getElementById("previewCount");
  const previewSkipBtn = document.getElementById("previewSkip");
  const overlay = document.getElementById("overlay");
  const winOverlay = document.getElementById("win");
  const winTimeEl = document.getElementById("winTime");
  const winBestEl = document.getElementById("winBest");
  const levelTitleEl = document.getElementById("levelTitle");
  const levelEyebrowEl = document.getElementById("levelEyebrow");
  const startBtn = document.getElementById("startBtn");
  const againBtn = document.getElementById("againBtn");
  const loseOverlay = document.getElementById("lose");
  const loseReasonEl = document.getElementById("loseReason");
  const loseBtn = document.getElementById("loseBtn");
  const dayBtn = document.getElementById("dayBtn");
  const nightBtn = document.getElementById("nightBtn");
  const helpBtn = document.getElementById("helpBtn");
  const helpOverlay = document.getElementById("helpOverlay");
  const helpCloseBtn = document.getElementById("helpClose");
  const hintBtn = document.getElementById("hintBtn");
  const hintCountEl = document.getElementById("hintCount");
  const ballBtn = document.getElementById("ballBtn");
  const ballPanel = document.getElementById("ballPanel");
  const ballIconEl = document.getElementById("ballIcon");
  const ballPreviewEl = document.getElementById("ballPreview");
  const ballColorGrid = document.getElementById("ballColorGrid");
  const ballPatternGrid = document.getElementById("ballPatternGrid");
  const ballCustomColor = document.getElementById("ballCustomColor");
  const ballCloseBtn = document.getElementById("ballClose");

  // ---------- Рендерер и сцена ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.07);

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 130);
  camera.position.set(0, 4, 6);

  // ---------- Свет ----------
  const hemi = new THREE.HemisphereLight(0x9ac4ff, 0x121a26, 1.7);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xcfe6ff, 2.1);
  dirLight.position.set(18, 28, 12);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -55;
  dirLight.shadow.camera.right = 55;
  dirLight.shadow.camera.top = 55;
  dirLight.shadow.camera.bottom = -55;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 130;
  dirLight.shadow.bias = -0.0006;
  dirLight.shadow.normalBias = 0.03;
  scene.add(dirLight);
  scene.add(dirLight.target);

  // мягкий фонарь, прикреплённый к камере
  const camLight = new THREE.PointLight(0xa8d4ff, 26, 18, 2);
  camLight.position.set(0, 0.15, 0);
  camera.add(camLight);
  scene.add(camera);

  // дополнительный свет для обзорной карты
  const previewFill = new THREE.HemisphereLight(0xffffff, 0xb8b0a0, 1.2);
  previewFill.visible = false;
  scene.add(previewFill);

  // ---------- Текстуры ----------
  function makeFloorTexture(day) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");

    g.fillStyle = day ? "#c9c3b4" : "#0d1420";
    g.fillRect(0, 0, 128, 128);

    // лёгкий шум
    for (let i = 0; i < 90; i++) {
      if (day) {
        const dark = Math.random() > 0.5;
        g.fillStyle = dark ? `rgba(90, 82, 66, ${0.02 + Math.random() * 0.05})` : `rgba(255, 252, 240, ${0.05 + Math.random() * 0.08})`;
      } else {
        g.fillStyle = `rgba(120, 170, 220, ${Math.random() * 0.05})`;
      }
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }

    // швы плитки
    g.strokeStyle = day ? "rgba(128, 117, 97, 0.65)" : "rgba(62, 104, 150, 0.55)";
    g.lineWidth = 2;
    g.strokeRect(1, 1, 126, 126);

    g.strokeStyle = day ? "rgba(158, 148, 127, 0.4)" : "rgba(30, 52, 80, 0.5)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(64, 6);
    g.lineTo(64, 122);
    g.moveTo(6, 64);
    g.lineTo(122, 64);
    g.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function makeWallTexture(day) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");

    const grad = g.createLinearGradient(0, 0, 0, 256);
    if (day) {
      grad.addColorStop(0, "#e6e1d4");
      grad.addColorStop(0.55, "#d3ccbd");
      grad.addColorStop(1, "#bdb4a3");
    } else {
      grad.addColorStop(0, "#26354b");
      grad.addColorStop(0.55, "#1b2739");
      grad.addColorStop(1, "#141d2c");
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);

    // горизонтальные швы панелей
    g.strokeStyle = day ? "rgba(125, 114, 95, 0.7)" : "rgba(6, 10, 18, 0.9)";
    g.lineWidth = 3;
    for (let y = 128; y < 256; y += 128) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }

    // вертикальные стыки
    g.strokeStyle = day ? "rgba(130, 119, 100, 0.55)" : "rgba(8, 13, 22, 0.7)";
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 256);
      g.stroke();
    }

    // шум / потёртости
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * 0.05;
      if (day) {
        g.fillStyle = Math.random() > 0.5 ? `rgba(255, 252, 240, ${a})` : `rgba(90, 80, 62, ${a * 0.9})`;
      } else {
        g.fillStyle = Math.random() > 0.5 ? `rgba(140, 185, 230, ${a})` : `rgba(0, 0, 0, ${a * 1.4})`;
      }
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 1 + Math.random() * 3);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function makeSunTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");

    // атмосферное сияние вокруг диска
    const halo = g.createRadialGradient(128, 128, 44, 128, 128, 128);
    halo.addColorStop(0, "rgba(255, 244, 198, 0.55)");
    halo.addColorStop(0.35, "rgba(255, 225, 145, 0.29)");
    halo.addColorStop(0.7, "rgba(255, 197, 92, 0.1)");
    halo.addColorStop(1, "rgba(255, 180, 70, 0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, 256, 256);

    // сам диск
    const disk = g.createRadialGradient(122, 120, 4, 128, 128, 62);
    disk.addColorStop(0, "#ffffff");
    disk.addColorStop(0.62, "#fffbe6");
    disk.addColorStop(0.9, "#fff0b8");
    disk.addColorStop(1, "#ffe59b");
    g.fillStyle = disk;
    g.beginPath();
    g.arc(128, 128, 62, 0, Math.PI * 2);
    g.fill();

    // лёгкое потемнение к краю — как у настоящего солнца
    const limb = g.createRadialGradient(128, 128, 50, 128, 128, 62);
    limb.addColorStop(0, "rgba(255, 240, 180, 0)");
    limb.addColorStop(1, "rgba(255, 205, 100, 0.55)");
    g.fillStyle = limb;
    g.beginPath();
    g.arc(128, 128, 62, 0, Math.PI * 2);
    g.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeSunGlowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255, 248, 214, 0.8)");
    grad.addColorStop(0.18, "rgba(255, 234, 165, 0.42)");
    grad.addColorStop(0.46, "rgba(255, 207, 112, 0.16)");
    grad.addColorStop(0.78, "rgba(255, 180, 70, 0.04)");
    grad.addColorStop(1, "rgba(255, 170, 60, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeSkyTexture(day) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const g = c.getContext("2d");

    const grad = g.createLinearGradient(0, 0, 0, 512);
    if (day) {
      grad.addColorStop(0, "#4b96d4");
      grad.addColorStop(0.42, "#7eb9e4");
      grad.addColorStop(0.72, "#b6d8ec");
      grad.addColorStop(1, "#d6ebf4");
    } else {
      grad.addColorStop(0, "#01030a");
      grad.addColorStop(0.42, "#030812");
      grad.addColorStop(0.72, "#07101d");
      grad.addColorStop(1, "#0c1a2b");
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 512);

    if (day) {
      // тёплая дымка у горизонта
      const haze = g.createLinearGradient(0, 300, 0, 512);
      haze.addColorStop(0, "rgba(255, 248, 228, 0)");
      haze.addColorStop(1, "rgba(255, 248, 228, 0.35)");
      g.fillStyle = haze;
      g.fillRect(0, 300, 1024, 212);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeMoonTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");

    const glow = g.createRadialGradient(128, 128, 48, 128, 128, 128);
    glow.addColorStop(0, "rgba(170,205,255,0.32)");
    glow.addColorStop(0.6, "rgba(150,190,255,0.12)");
    glow.addColorStop(1, "rgba(150,190,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, 256, 256);

    const body = g.createRadialGradient(108, 104, 10, 128, 128, 72);
    body.addColorStop(0, "#f4f8ff");
    body.addColorStop(0.7, "#dce8ff");
    body.addColorStop(1, "#aebfd9");
    g.fillStyle = body;
    g.beginPath();
    g.arc(128, 128, 70, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "rgba(140,160,190,0.35)";
    const craters = [
      [106, 112, 11], [143, 100, 7], [152, 143, 12], [116, 155, 8], [92, 134, 6],
      [136, 122, 4], [166, 122, 5],
    ];
    for (const [x, y, r] of craters) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeStarTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(220,236,255,0.9)");
    grad.addColorStop(1, "rgba(180,215,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeWaterTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#2b82a0");
    grad.addColorStop(0.5, "#1c647f");
    grad.addColorStop(1, "#154a63");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);

    g.strokeStyle = "rgba(190,240,255,0.16)";
    g.lineWidth = 2;
    for (let y = 10; y < 256; y += 24) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const yy = y + Math.sin((x / 256) * Math.PI * 4 + y) * 5;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }

    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(220,250,255,${0.03 + Math.random() * 0.08})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 7, 1);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function makeBridgeTexture() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#8a6138";
    g.fillRect(0, 0, 128, 256);

    for (let y = 0; y < 256; y += 32) {
      const shade2 = y % 64 === 0 ? "#93683c" : "#825a32";
      g.fillStyle = shade2;
      g.fillRect(4, y + 2, 120, 28);

      g.strokeStyle = "rgba(60, 36, 16, 0.55)";
      g.lineWidth = 2;
      g.strokeRect(4, y + 2, 120, 28);

      g.strokeStyle = "rgba(190, 150, 100, 0.18)";
      g.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(8, y + 8 + i * 6);
        g.bezierCurveTo(44, y + 4 + i * 6, 84, y + 12 + i * 6, 120, y + 7 + i * 6);
        g.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function makeDustTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(190,225,255,0.55)");
    grad.addColorStop(1, "rgba(120,180,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function hexToRgb(hex) {
    let h = String(hex).replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = Number.parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function mixHex(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const k = Math.max(0, Math.min(1, t));
    const r = Math.round(ca.r + (cb.r - ca.r) * k);
    const g = Math.round(ca.g + (cb.g - ca.g) * k);
    const bl = Math.round(ca.b + (cb.b - ca.b) * k);
    return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  function shade(hex, amount) {
    return amount >= 0 ? mixHex(hex, "#ffffff", amount) : mixHex(hex, "#000000", -amount);
  }

  function rgbaOf(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
  }

  function makeRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isLightColor(hex) {
    const c = hexToRgb(hex);
    return (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255 > 0.58;
  }

  function drawPentagon(g, x, y, r, rotation, fill, stroke) {
    for (const offset of [-512, 0, 512]) {
      const cx = x + offset;
      if (cx < -r * 2 || cx > 512 + r * 2) continue;
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rotation + (i * Math.PI * 2) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      if (stroke) {
        g.strokeStyle = stroke;
        g.lineWidth = 2;
        g.stroke();
      }
    }
  }

  function makeBallTexture(color, pattern) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");
    const rnd = makeRandom(1337);

    // база: лёгкий градиент от света к тени
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, shade(color, 0.3));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, shade(color, -0.34));
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);

    const dark = shade(color, -0.5);
    const light = shade(color, 0.55);
    const lightBase = isLightColor(color);
    const sportDark = lightBase ? "#1b1b1b" : "#f2f2f2";
    const sportLight = lightBase ? "#ffffff" : "#f6f6ee";

    if (pattern === "stripes") {
      g.strokeStyle = rgbaOf(dark, 0.42);
      g.lineWidth = 22;
      for (let i = 0; i < 6; i++) {
        const y = 20 + i * 44;
        g.beginPath();
        g.moveTo(-20, y);
        g.bezierCurveTo(150, y + 70, 360, y - 70, 540, y);
        g.stroke();
      }
      g.strokeStyle = rgbaOf(light, 0.2);
      g.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const y = 30 + i * 44;
        g.beginPath();
        g.moveTo(-20, y);
        g.bezierCurveTo(150, y + 70, 360, y - 70, 540, y);
        g.stroke();
      }
    } else if (pattern === "dots") {
      for (let i = 0; i < 38; i++) {
        const dot = i % 3 === 0 ? rgbaOf(light, 0.9) : rgbaOf(dark, 0.55);
        g.fillStyle = dot;
        g.beginPath();
        g.arc(rnd() * 512, rnd() * 256, 4 + rnd() * 11, 0, Math.PI * 2);
        g.fill();
      }
    } else if (pattern === "checker") {
      const cell = 64;
      for (let y = 0; y < 256; y += cell) {
        for (let x = 0; x < 512; x += cell) {
          const even = ((x / cell) + (y / cell)) % 2 === 0;
          g.fillStyle = even ? rgbaOf(dark, 0.28) : rgbaOf(light, 0.16);
          g.fillRect(x, y, cell, cell);
        }
      }
    } else if (pattern === "waves") {
      g.lineCap = "round";
      for (let i = -2; i < 9; i++) {
        g.strokeStyle = rgbaOf(i % 2 === 0 ? dark : light, 0.3);
        g.lineWidth = 26;
        g.beginPath();
        for (let x = -20; x <= 532; x += 8) {
          const y = i * 46 + x * 0.24 + Math.sin(x * 0.022 + i * 0.8) * 18;
          if (x === -20) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    } else if (pattern === "segments") {
      const band = 64;
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
          g.fillStyle = rgbaOf(dark, 0.34);
          g.fillRect(i * band, 0, band, 256);
        }
        g.strokeStyle = rgbaOf(light, 0.22);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(i * band + 0.5, 0);
        g.lineTo(i * band + 0.5, 256);
        g.stroke();
      }
    } else if (pattern === "soccer") {
      const spots = [
        [34, 56, 27], [148, 32, 24], [262, 80, 30], [382, 42, 25], [496, 116, 29],
        [86, 158, 27], [204, 198, 24], [330, 160, 31], [452, 214, 25], [16, 230, 22],
      ];
      spots.forEach(([x, y, r], i) => {
        drawPentagon(g, x, y, r, i * 0.63, sportDark, lightBase ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)");
      });

      g.strokeStyle = lightBase ? "rgba(60,60,60,0.28)" : "rgba(255,255,255,0.2)";
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(-20, 20 + i * 48);
        g.bezierCurveTo(150, 60 + i * 46, 360, 200 - i * 36, 540, 230 - i * 44);
        g.stroke();
      }
    } else if (pattern === "basketball") {
      const seam = lightBase ? "#2a170a" : "#f0efea";
      g.strokeStyle = rgbaOf(seam, 0.85);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(0, 128);
      g.lineTo(512, 128);
      g.stroke();

      for (let x = 0; x <= 512; x += 128) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, 256);
        g.stroke();
      }

      g.strokeStyle = rgbaOf(seam, 0.7);
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(-20, 24);
      g.bezierCurveTo(150, 80, 360, 176, 532, 232);
      g.stroke();
      g.beginPath();
      g.moveTo(-20, 232);
      g.bezierCurveTo(150, 176, 360, 80, 532, 24);
      g.stroke();

      // «пупырышки»
      for (let i = 0; i < 150; i++) {
        g.fillStyle = rgbaOf(dark, 0.14);
        g.beginPath();
        g.arc(rnd() * 512, rnd() * 256, 1.5 + rnd() * 1.5, 0, Math.PI * 2);
        g.fill();
      }
    } else if (pattern === "tennis") {
      const drawSeam = () => {
        g.beginPath();
        g.moveTo(-20, 62);
        g.bezierCurveTo(170, 12, 342, 244, 532, 194);
        g.stroke();
        g.beginPath();
        g.moveTo(-20, 194);
        g.bezierCurveTo(170, 244, 342, 12, 532, 62);
        g.stroke();
      };

      g.lineCap = "round";
      g.strokeStyle = "rgba(0,0,0,0.18)";
      g.lineWidth = 11;
      drawSeam();
      g.strokeStyle = sportLight;
      g.lineWidth = 6;
      drawSeam();

      // «ворс»
      for (let i = 0; i < 260; i++) {
        g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
        g.fillRect(rnd() * 512, rnd() * 256, 1.5, 1.5);
      }
    } else if (pattern === "volleyball") {
      const seam = lightBase ? "#ffffff" : "#f4f4f4";
      const panel = rgbaOf(shade(color, -0.35), 0.55);
      g.lineCap = "round";

      const curves = [
        () => { g.moveTo(-20, 68); g.bezierCurveTo(160, 104, 352, 152, 532, 188); },
        () => { g.moveTo(-20, 188); g.bezierCurveTo(160, 152, 352, 104, 532, 68); },
        () => { g.moveTo(128, -20); g.bezierCurveTo(88, 80, 168, 180, 118, 276); },
        () => { g.moveTo(384, -20); g.bezierCurveTo(424, 80, 344, 180, 394, 276); },
      ];

      for (const c2 of curves) {
        g.beginPath();
        g.strokeStyle = panel;
        g.lineWidth = 46;
        c2();
        g.stroke();
      }
      for (const c2 of curves) {
        g.beginPath();
        g.strokeStyle = seam;
        g.lineWidth = 4;
        c2();
        g.stroke();
      }
    }

    // лёгкая фактура
    for (let i = 0; i < 160; i++) {
      g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
      g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  // ---------- Материалы и общие геометрии ----------
  const floorTexNight = makeFloorTexture(false);
  const floorTexDay = makeFloorTexture(true);
  floorTexNight.repeat.set(COLS, ROWS);
  floorTexDay.repeat.set(COLS, ROWS);

  const wallTexNight = makeWallTexture(false);
  const wallTexDay = makeWallTexture(true);

  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);

  function makeTopFrameGeometry(size, thickness) {
    const outer = size / 2;
    const inner = outer - thickness;
    const shape = new THREE.Shape();
    shape.moveTo(-outer, -outer);
    shape.lineTo(outer, -outer);
    shape.lineTo(outer, outer);
    shape.lineTo(-outer, outer);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-inner, -inner);
    hole.lineTo(-inner, inner);
    hole.lineTo(inner, inner);
    hole.lineTo(inner, -inner);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  const trimGeo = makeTopFrameGeometry(CELL * 0.995, 0.085);

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTexNight,
    color: 0xb8c9dd,
    roughness: 0.78,
    metalness: 0.16,
    emissive: 0x07111c,
    emissiveIntensity: 0.9,
  });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x2a6678, side: THREE.DoubleSide });

  // ---------- Земля ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x04070c, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL),
    new THREE.MeshStandardMaterial({
      map: floorTexNight,
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.08,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- Река, мостики, ямы ----------
  const waterTex = makeWaterTexture();
  waterTex.repeat.set(9, 2);
  const waterGeo = new THREE.PlaneGeometry(90, 6);
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.25,
    transparent: true,
    opacity: 0.92,
    emissive: 0x052434,
    emissiveIntensity: 0.6,
  });

  const bridgeDeckGeo = new THREE.BoxGeometry(1.5, 0.12, 7.8);
  const bridgeDeckMat = new THREE.MeshStandardMaterial({
    map: makeBridgeTexture(),
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.02,
  });
  const bridgeEdgeGeo = new THREE.BoxGeometry(0.06, 0.06, 7.8);
  const bridgeEdgeMat = new THREE.MeshBasicMaterial({ color: 0xffc777, transparent: true, opacity: 0.75 });

  const pitDiskGeo = new THREE.CircleGeometry(PIT_RADIUS, 32);
  pitDiskGeo.rotateX(-Math.PI / 2);
  const pitRimGeo = new THREE.RingGeometry(PIT_RADIUS, PIT_RADIUS + 0.09, 32);
  pitRimGeo.rotateX(-Math.PI / 2);
  const pitDiskMat = new THREE.MeshBasicMaterial({ color: 0x010204 });
  const pitRimMat = new THREE.MeshBasicMaterial({
    color: 0xff8a4c,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const fencePostGeo = new THREE.BoxGeometry(0.1, 0.9, 0.1);
  const fenceRailGeo = new THREE.BoxGeometry(1, 0.07, 0.07);
  const fenceMat = new THREE.MeshStandardMaterial({
    color: 0x8a6138,
    roughness: 0.85,
    metalness: 0.02,
  });

  let riverGroup = null;
  let pitDisks = null;
  let pitRims = null;

  // ---------- Шарик ----------
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 48, 32),
    new THREE.MeshStandardMaterial({
      map: makeBallTexture(ballColor, ballPattern),
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.15,
      emissive: shade(ballColor, -0.1),
      emissiveIntensity: 0.28,
    })
  );
  ball.castShadow = true;
  ball.receiveShadow = true;
  scene.add(ball);

  const ballLight = new THREE.PointLight(shade(ballColor, 0.18), 16, 8, 2);
  ballLight.position.set(0, 0.7, 0);
  ball.add(ballLight);

  // ---------- Выход ----------
  const goalGroup = new THREE.Group();
  scene.add(goalGroup);

  const goalPad = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 40),
    new THREE.MeshBasicMaterial({
      color: 0x37ffb2,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  goalPad.rotation.x = -Math.PI / 2;
  goalPad.position.y = 0.025;
  goalGroup.add(goalPad);

  const goalRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.055, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0x8affd8, transparent: true, opacity: 0.9 })
  );
  goalRing.rotation.x = -Math.PI / 2;
  goalRing.position.y = 0.06;
  goalGroup.add(goalRing);

  const goalLight = new THREE.PointLight(0x40ffbe, 22, 11, 2);
  goalLight.position.y = 1;
  goalGroup.add(goalLight);

  // ---------- Ключи ----------
  const keyGeo = new THREE.OctahedronGeometry(0.27, 0);
  const keyMat = new THREE.MeshStandardMaterial({
    color: 0xffd36a,
    emissive: 0xffa514,
    emissiveIntensity: 1.5,
    metalness: 0.45,
    roughness: 0.22,
  });
  const keyRingGeo = new THREE.TorusGeometry(0.4, 0.025, 8, 40);
  const keyRingMat = new THREE.MeshBasicMaterial({
    color: 0xffd36a,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const keyItems = [];
  for (let i = 0; i < KEY_COUNT; i++) {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(keyGeo, keyMat);
    crystal.position.y = 0.75;
    const ring = new THREE.Mesh(keyRingGeo, keyRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.035;
    const light = new THREE.PointLight(0xffc04a, 8, 6, 2);
    light.position.y = 0.8;
    group.add(crystal, ring, light);
    group.visible = false;
    scene.add(group);
    keyItems.push({ group, crystal, ring, light, collected: false, cell: null });
  }

  // ---------- Стрелка подсказки ----------
  const hintArrowShape = new THREE.Shape();
  hintArrowShape.moveTo(0, 0.55);
  hintArrowShape.lineTo(-0.34, 0.05);
  hintArrowShape.lineTo(-0.12, 0.05);
  hintArrowShape.lineTo(-0.12, -0.45);
  hintArrowShape.lineTo(0.12, -0.45);
  hintArrowShape.lineTo(0.12, 0.05);
  hintArrowShape.lineTo(0.34, 0.05);
  hintArrowShape.closePath();
  const hintArrowGeo = new THREE.ShapeGeometry(hintArrowShape);
  hintArrowGeo.rotateX(-Math.PI / 2);

  const hintPathMat = new THREE.MeshBasicMaterial({
    color: 0xffd36a,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const hintPathGroup = new THREE.Group();
  hintPathGroup.visible = false;
  scene.add(hintPathGroup);

  // ---------- Маркеры для обзорной карты ----------
  const previewMarkerGroup = new THREE.Group();
  previewMarkerGroup.visible = false;
  scene.add(previewMarkerGroup);

  const previewRingGeo = new THREE.RingGeometry(1.0, 1.35, 40);
  previewRingGeo.rotateX(-Math.PI / 2);
  const previewKeyMat = new THREE.MeshBasicMaterial({
    color: 0xffd36a,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const previewGoalMat = new THREE.MeshBasicMaterial({
    color: 0x4ef0c4,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const previewStartMat = new THREE.MeshBasicMaterial({
    color: 0x9fd2ff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // ---------- Пылинки ----------
  const dustCount = 2200;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const halfW = (COLS * CELL) / 2;
  const halfH = (ROWS * CELL) / 2;
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * COLS * CELL;
    dustPos[i * 3 + 1] = 0.15 + Math.random() * 3.8;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * ROWS * CELL;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      map: makeDustTexture(),
      color: 0x9fd2ff,
      size: 0.07,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(dust);

  // ---------- Небо: солнце, луна, звёзды ----------
  const skyGroup = new THREE.Group();
  scene.add(skyGroup);

  const skyTexDay = makeSkyTexture(true);
  const skyTexNight = makeSkyTexture(false);

  const sunGroup = new THREE.Group();
  sunGroup.position.set(50, 6, 20);

  const sunGlowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeSunGlowTexture(),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  sunGlowSprite.scale.set(18, 18, 1);
  sunGroup.add(sunGlowSprite);

  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeSunTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
    })
  );
  sunSprite.scale.set(5, 5, 1);
  sunGroup.add(sunSprite);
  skyGroup.add(sunGroup);

  const moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeMoonTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.98,
    })
  );
  moonSprite.position.set(32, 6, 14);
  moonSprite.scale.set(7, 7, 1);
  skyGroup.add(moonSprite);

  const starCount = 750;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const azimuth = Math.random() * Math.PI * 2;
    const elevation = (2 + Math.random() * 30) * (Math.PI / 180);
    const r = 96;
    const horizontal = Math.cos(elevation) * r;
    starPos[i * 3] = Math.cos(azimuth) * horizontal;
    starPos[i * 3 + 1] = Math.sin(elevation) * r;
    starPos[i * 3 + 2] = Math.sin(azimuth) * horizontal;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starField = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      map: makeStarTexture(),
      color: 0xffffff,
      size: 1.05,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      sizeAttenuation: true,
    })
  );
  skyGroup.add(starField);

  // ---------- Состояние ----------
  const keys = new Set();
  let mode = "menu"; // menu | playing | transition | falling | lost
  let level = 1;
  let time = 0;
  let keysCollected = 0;
  let fallState = null;
  let fallTimer = null;
  let previewTimer = null;
  let previewInterval = null;
  let previewEndsAt = 0;
  let jumpRequested = false;
  let transitionTimer = null;
  let toastTimer = null;
  let lastLockedNotice = 0;
  let hintsLeft = 10;
  let hintState = null;
  let helpOpen = false;
  let helpOpenedAt = 0;
  let helpRevealTimer = null;

  let bestByLevel = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem("labirint.best.levels.v1") || "null");
      if (saved && typeof saved === "object") return saved;
    } catch (e) {
      /* ignore */
    }
    const legacy = Number.parseFloat(localStorage.getItem("labirint.best.v2"));
    return legacy ? { 1: legacy } : {};
  })();

  let theme = localStorage.getItem("labirint.theme") === "day" ? "day" : "night";
  let goalLightBase = theme === "day" ? 10 : 16;
  let goalLightPulse = theme === "day" ? 8 : 14;

  let wallMesh = null;
  let trimMesh = null;
  let maze = null;

  const vel = new THREE.Vector2(0, 0);
  const GROUND_Y = BALL_R + 0.01;
  let ballY = GROUND_Y;
  let ballVY = 0;
  let grounded = true;
  let camYaw = -Math.PI * 0.75;
  const camLook = new THREE.Vector3();

  // ---------- Генерация лабиринта ----------
  const START_CELL = { x: 23, y: 23 };
  const GOAL_CELL = { x: COLS - 2, y: ROWS - 2 };

  function generateGrid() {
    const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(1));
    const stack = [[1, 1]];
    grid[1][1] = 0;

    const dirs = [
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
    ];

    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const options = [];

      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && grid[ny][nx] === 1) {
          options.push([nx, ny, dx, dy]);
        }
      }

      if (!options.length) {
        stack.pop();
        continue;
      }

      const [nx, ny, dx, dy] = options[(Math.random() * options.length) | 0];
      grid[cy + dy / 2][cx + dx / 2] = 0;
      grid[ny][nx] = 0;
      stack.push([nx, ny]);
    }

    // немного петель, чтобы не было бесконечных тупиков
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (grid[y][x] !== 1 || Math.random() > 0.035) continue;
        const horizontal = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
        const vertical = grid[y - 1][x] === 0 && grid[y + 1][x] === 0;
        if (horizontal || vertical) grid[y][x] = 0;
      }
    }

    // небольшая стартовая площадка в центре
    for (let y = START_CELL.y - 1; y <= START_CELL.y + 1; y++) {
      for (let x = START_CELL.x - 1; x <= START_CELL.x + 1; x++) {
        grid[y][x] = 0;
      }
    }

    return grid;
  }

  function cellToWorld(x, y) {
    return {
      x: (x - (COLS - 1) / 2) * CELL,
      z: (y - (ROWS - 1) / 2) * CELL,
    };
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function makePassable(grid, river) {
    return (x, y) => {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
      if (grid[y][x] !== 0) return false;
      if (river && river.waterCells.has(cellKey(x, y)) && !river.bridgeColumns.has(x)) return false;
      return true;
    };
  }

  function bfsDistancesFrom(sx, sy, passable) {
    const dist = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
    if (!passable(sx, sy)) return dist;

    const qx = [sx];
    const qy = [sy];
    dist[sy][sx] = 0;

    for (let i = 0; i < qx.length; i++) {
      const x = qx[i];
      const y = qy[i];
      const d = dist[y][x] + 1;
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (dist[ny][nx] !== -1) continue;
        if (!passable(nx, ny)) continue;
        dist[ny][nx] = d;
        qx.push(nx);
        qy.push(ny);
      }
    }

    return dist;
  }

  function shuffleList(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  }

  function gridDistance(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  function carveRiver(grid) {
    const northRow = RIVER_ROWS[0] - 1;
    const southRow = RIVER_ROWS[RIVER_ROWS.length - 1] + 1;
    const candidates = [];

    for (let x = 1; x < COLS - 1; x++) {
      if (grid[northRow][x] === 0 && grid[southRow][x] === 0) {
        candidates.push(x);
      }
    }

    if (candidates.length === 0) return null;

    const picks = new Set();
    const maxBridges = 9;

    if (candidates.length <= maxBridges) {
      for (const x of candidates) picks.add(x);
    } else {
      for (let i = 0; i < maxBridges; i++) {
        const idx = Math.round((i * (candidates.length - 1)) / (maxBridges - 1));
        picks.add(candidates[idx]);
      }
    }

    const waterCells = new Set();
    for (let y = RIVER_ROWS[0]; y <= RIVER_ROWS[RIVER_ROWS.length - 1]; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        grid[y][x] = 0;
        waterCells.add(cellKey(x, y));
      }
    }

    const bridgeColumns = new Set(picks);
    const bridges = [...picks].sort((a, b) => a - b).map((cellX) => ({
      cellX,
      x: cellToWorld(cellX, 0).x,
    }));

    const zMin = cellToWorld(0, RIVER_ROWS[0]).z - CELL / 2;
    const zMax = cellToWorld(0, RIVER_ROWS[RIVER_ROWS.length - 1]).z + CELL / 2;

    const bridgeGapHalf = 0.95;
    const fenceSegments = [];

    for (const z of [zMin + 0.08, zMax - 0.08]) {
      let cursor = -45;
      for (const bridge of bridges) {
        const gapStart = bridge.x - bridgeGapHalf;
        const gapEnd = bridge.x + bridgeGapHalf;
        if (gapStart > cursor + 0.05) {
          fenceSegments.push({ x1: cursor, x2: gapStart, z });
        }
        cursor = Math.max(cursor, gapEnd);
      }
      if (cursor < 45 - 0.05) {
        fenceSegments.push({ x1: cursor, x2: 45, z });
      }
    }

    return {
      zMin,
      zMax,
      waterCells,
      bridgeColumns,
      bridges,
      bridgeGapHalf,
      fenceSegments,
    };
  }

  function chooseKeyCells(grid, river) {
    const passable = makePassable(grid, river);
    const dist = bfsDistancesFrom(START_CELL.x, START_CELL.y, passable);
    const candidates = [];

    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (!passable(x, y)) continue;
        if (river && y >= RIVER_ROWS[0] && y <= RIVER_ROWS[RIVER_ROWS.length - 1]) continue;
        if (x === GOAL_CELL.x && y === GOAL_CELL.y) continue;
        if (gridDistance({ x, y }, START_CELL) <= 3) continue;
        if (gridDistance({ x, y }, GOAL_CELL) <= 1) continue;
        if (dist[y][x] < 8) continue;
        candidates.push({ x, y });
      }
    }

    shuffleList(candidates);
    const chosen = [];

    for (const cell of candidates) {
      if (chosen.some((k) => gridDistance(k, cell) < 8)) continue;
      chosen.push(cell);
      if (chosen.length === KEY_COUNT) break;
    }

    // страховка на случай очень тесного лабиринта
    for (const cell of candidates) {
      if (chosen.length === KEY_COUNT) break;
      if (chosen.some((k) => k.x === cell.x && k.y === cell.y)) continue;
      chosen.push(cell);
    }

    return chosen;
  }

  function choosePitCells(grid, river, keyCells) {
    const candidates = [];
    const goalCell = GOAL_CELL;

    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (grid[y][x] !== 0) continue;
        if (river && y >= RIVER_ROWS[0] - 1 && y <= RIVER_ROWS[RIVER_ROWS.length - 1] + 1) continue;
        if (gridDistance({ x, y }, START_CELL) <= 2) continue;
        if (gridDistance({ x, y }, goalCell) <= 2) continue;
        if (keyCells.some((k) => gridDistance(k, { x, y }) <= 1)) continue;
        candidates.push({ x, y });
      }
    }

    shuffleList(candidates);
    const pits = [];

    for (const cell of candidates) {
      if (pits.length >= 12) break;
      if (pits.some((p) => gridDistance(p, cell) <= 5)) continue;
      if (Math.random() > 0.7) continue;
      pits.push(cell);
    }

    return pits;
  }

  function buildRiverVisuals() {
    if (riverGroup) {
      riverGroup.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
      scene.remove(riverGroup);
      riverGroup = null;
    }
    if (!maze || !maze.river) return;

    const group = new THREE.Group();
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.02, (maze.river.zMin + maze.river.zMax) / 2);
    water.receiveShadow = true;
    group.add(water);

    for (const bridge of maze.river.bridges) {
      const deck = new THREE.Mesh(bridgeDeckGeo, bridgeDeckMat);
      deck.position.set(bridge.x, 0, (maze.river.zMin + maze.river.zMax) / 2);
      deck.receiveShadow = true;
      group.add(deck);

      for (const side of [-0.73, 0.73]) {
        const edge = new THREE.Mesh(bridgeEdgeGeo, bridgeEdgeMat);
        edge.position.set(bridge.x + side, 0.07, (maze.river.zMin + maze.river.zMax) / 2);
        group.add(edge);
      }
    }

    // забор по берегам и бортики мостов
    const postPositions = [];
    const railInstances = [];
    const addPosts = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const count = Math.max(2, Math.ceil(len / 2.4) + 1);
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        postPositions.push({
          x: x1 + (x2 - x1) * t,
          z: z1 + (z2 - z1) * t,
        });
      }
    };
    const addRail = (x1, z1, x2, z2, y) => {
      railInstances.push({
        x: (x1 + x2) / 2,
        z: (z1 + z2) / 2,
        length: Math.hypot(x2 - x1, z2 - z1),
        alongX: Math.abs(x2 - x1) > Math.abs(z2 - z1),
        y,
      });
    };

    for (const segment of maze.river.fenceSegments) {
      addPosts(segment.x1, segment.z, segment.x2, segment.z);
      addRail(segment.x1, segment.z, segment.x2, segment.z, 0.36);
      addRail(segment.x1, segment.z, segment.x2, segment.z, 0.68);
    }

    for (const bridge of maze.river.bridges) {
      for (const side of [-0.88, 0.88]) {
        const x = bridge.x + side;
        addPosts(x, maze.river.zMin, x, maze.river.zMax);
        addRail(x, maze.river.zMin, x, maze.river.zMax, 0.36);
        addRail(x, maze.river.zMin, x, maze.river.zMax, 0.68);
      }
    }

    if (postPositions.length) {
      const posts = new THREE.InstancedMesh(fencePostGeo, fenceMat, postPositions.length);
      posts.castShadow = true;
      const m = new THREE.Matrix4();
      postPositions.forEach((p, i) => {
        m.makeTranslation(p.x, 0.45, p.z);
        posts.setMatrixAt(i, m);
      });
      posts.instanceMatrix.needsUpdate = true;
      posts.computeBoundingSphere();
      group.add(posts);
    }

    if (railInstances.length) {
      const rails = new THREE.InstancedMesh(fenceRailGeo, fenceMat, railInstances.length);
      rails.castShadow = true;
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const yQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

      railInstances.forEach((r, i) => {
        pos.set(r.x, r.y, r.z);
        scale.set(r.length, 1, 1);
        quat.copy(r.alongX ? new THREE.Quaternion() : yQuat);
        m.compose(pos, quat, scale);
        rails.setMatrixAt(i, m);
      });
      rails.instanceMatrix.needsUpdate = true;
      rails.computeBoundingSphere();
      group.add(rails);
    }

    riverGroup = group;
    scene.add(group);
  }

  function buildPitVisuals() {
    if (pitDisks) {
      scene.remove(pitDisks);
      pitDisks.dispose();
      pitDisks = null;
    }
    if (pitRims) {
      scene.remove(pitRims);
      pitRims.dispose();
      pitRims = null;
    }

    const pits = maze ? maze.pits : [];
    if (!pits.length) return;

    pitDisks = new THREE.InstancedMesh(pitDiskGeo, pitDiskMat, pits.length);
    pitRims = new THREE.InstancedMesh(pitRimGeo, pitRimMat, pits.length);
    pitRims.renderOrder = 1;

    const m = new THREE.Matrix4();
    pits.forEach((pit, i) => {
      m.makeTranslation(pit.world.x, 0.022, pit.world.z);
      pitDisks.setMatrixAt(i, m);
      m.makeTranslation(pit.world.x, 0.034, pit.world.z);
      pitRims.setMatrixAt(i, m);
    });

    pitDisks.instanceMatrix.needsUpdate = true;
    pitRims.instanceMatrix.needsUpdate = true;
    pitDisks.computeBoundingSphere();
    pitRims.computeBoundingSphere();
    scene.add(pitDisks);
    scene.add(pitRims);
  }

  function buildMaze() {
    const grid = generateGrid();
    const river = carveRiver(grid);
    const keyCells = chooseKeyCells(grid, river);
    const pitCells = choosePitCells(grid, river, keyCells);

    if (wallMesh) {
      scene.remove(wallMesh);
      wallMesh.dispose();
      wallMesh = null;
    }
    if (trimMesh) {
      scene.remove(trimMesh);
      trimMesh.dispose();
      trimMesh = null;
    }

    const wallCells = [];
    const walls = [];

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] !== 1) continue;

        const world = cellToWorld(x, y);
        wallCells.push(world);

        walls.push({
          minX: world.x - CELL / 2,
          maxX: world.x + CELL / 2,
          minZ: world.z - CELL / 2,
          maxZ: world.z + CELL / 2,
        });
      }
    }

    if (river) {
      // забор по берегам — попасть в воду можно только через мосты
      for (const segment of river.fenceSegments) {
        walls.push({
          minX: segment.x1,
          maxX: segment.x2,
          minZ: segment.z - 0.06,
          maxZ: segment.z + 0.06,
        });
      }

      // бортики мостов, чтобы с моста нельзя было свалиться в воду
      for (const bridge of river.bridges) {
        for (const side of [-0.88, 0.88]) {
          walls.push({
            minX: bridge.x + side - 0.035,
            maxX: bridge.x + side + 0.035,
            minZ: river.zMin,
            maxZ: river.zMax,
          });
        }
      }
    }

    wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, wallCells.length);
    trimMesh = new THREE.InstancedMesh(trimGeo, trimMat, wallCells.length);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    wallCells.forEach((p, i) => {
      m.makeTranslation(p.x, WALL_H / 2, p.z);
      wallMesh.setMatrixAt(i, m);
      m.makeTranslation(p.x, WALL_H + 0.01, p.z);
      trimMesh.setMatrixAt(i, m);
    });
    wallMesh.instanceMatrix.needsUpdate = true;
    trimMesh.instanceMatrix.needsUpdate = true;
    wallMesh.computeBoundingSphere();
    trimMesh.computeBoundingSphere();

    scene.add(wallMesh);
    scene.add(trimMesh);

    const goalWorld = cellToWorld(GOAL_CELL.x, GOAL_CELL.y);

    maze = {
      grid,
      walls,
      start: cellToWorld(START_CELL.x, START_CELL.y),
      goal: goalWorld,
      keyCells,
      pits: pitCells.map((c) => ({ ...c, world: cellToWorld(c.x, c.y) })),
      river,
    };

    goalGroup.position.set(goalWorld.x, 0, goalWorld.z);
    buildRiverVisuals();
    buildPitVisuals();
    resetBall();
    updateCamera(1, true);
  }

  // ---------- Сброс ----------
  function pickStartYaw() {
    const { x, y } = START_CELL;
    const dirs = [
      { dx: 1, dy: 0, yaw: -Math.PI / 2 },
      { dx: 0, dy: 1, yaw: Math.PI },
      { dx: -1, dy: 0, yaw: Math.PI / 2 },
      { dx: 0, dy: -1, yaw: 0 },
    ];

    let best = null;
    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (!maze || maze.grid[ny]?.[nx] !== 0) continue;
      // предпочитаем направление, где коридор продолжается
      const far = maze.grid[y + d.dy * 2]?.[x + d.dx * 2] === 0;
      if (!best || (far && !best.far)) best = { ...d, far };
    }

    return best ? best.yaw : -Math.PI / 2;
  }

  function resetBall() {
    ball.position.set(maze.start.x, GROUND_Y, maze.start.z);
    ballY = GROUND_Y;
    ballVY = 0;
    grounded = true;
    jumpRequested = false;
    ball.quaternion.identity();
    vel.set(0, 0);
    camYaw = pickStartYaw();
    camLook.set(maze.start.x, 0.6, maze.start.z);
    resetKeys();
    hideHint();
    updateCamera(1, true);
  }

  function resetKeys() {
    keysCollected = 0;
    const cells = maze && maze.keyCells ? maze.keyCells : [];

    keyItems.forEach((item, i) => {
      const cell = cells[i];
      item.collected = false;
      item.cell = cell || null;
      item.group.visible = !!cell;

      if (cell) {
        const world = cellToWorld(cell.x, cell.y);
        item.group.position.set(world.x, 0, world.z);
        item.crystal.position.y = 0.75;
        item.crystal.scale.setScalar(1);
        item.ring.scale.setScalar(1);
      }
    });

    updateGoalVisuals();
    updateHud();
    updateHintButton();
  }

  function updateGoalVisuals() {
    const open = keysCollected >= KEY_COUNT;
    goalPad.material.color.set(open ? 0x37ffb2 : 0xffb45e);
    goalRing.material.color.set(open ? 0x8affd8 : 0xffd9a0);
    goalLight.color.set(open ? 0x40ffbe : 0xffa04a);
  }

  function collectKey(item) {
    if (!item || item.collected) return;
    item.collected = true;
    item.group.visible = false;
    keysCollected += 1;
    updateGoalVisuals();
    updateHud();

    if (keysCollected >= KEY_COUNT) {
      showToast("Все ключи собраны — выход открыт!", "good");
    } else {
      showToast(`Ключ ${keysCollected} из ${KEY_COUNT}`, "good");
    }
  }

  function startFall(reason) {
    if (mode !== "playing") return;
    mode = "falling";
    keys.clear();
    jumpRequested = false;
    grounded = false;
    ballVY = -2.5;
    fallState = { reason, started: performance.now() };
    clearTimeout(fallTimer);
    fallTimer = setTimeout(showLoseScreen, 950);
    hideHint();
    updateHintButton();
  }

  function showLoseScreen() {
    clearTimeout(fallTimer);
    fallTimer = null;
    if (mode !== "falling") return;
    mode = "lost";
    loseReasonEl.textContent = fallState && fallState.reason === "river" ? "Вы упали в реку." : "Вы упали в яму.";
    loseOverlay.classList.remove("hidden");
    updateHintButton();
  }

  // ---------- Обзорная карта перед стартом ----------
  function clearPreviewMarkers() {
    previewMarkerGroup.visible = false;
    while (previewMarkerGroup.children.length) {
      previewMarkerGroup.remove(previewMarkerGroup.children[0]);
    }
  }

  function buildPreviewMarkers() {
    clearPreviewMarkers();

    for (const item of keyItems) {
      if (!item.group.visible) continue;
      const ring = new THREE.Mesh(previewRingGeo, previewKeyMat);
      ring.position.set(item.group.position.x, 0.07, item.group.position.z);
      ring.scale.setScalar(1.8);
      previewMarkerGroup.add(ring);
    }

    const goalRing = new THREE.Mesh(previewRingGeo, previewGoalMat);
    goalRing.position.set(maze.goal.x, 0.07, maze.goal.z);
    goalRing.scale.setScalar(2.4);
    previewMarkerGroup.add(goalRing);

    const startRing = new THREE.Mesh(previewRingGeo, previewStartMat);
    startRing.position.set(maze.start.x, 0.08, maze.start.z);
    startRing.scale.setScalar(1.5);
    previewMarkerGroup.add(startRing);

    previewMarkerGroup.visible = true;
  }

  function applyPreviewMapLook() {
    wallMat.map = wallTexDay;
    wallMat.color.set(0xffffff);
    wallMat.emissive.set(0x000000);
    wallMat.emissiveIntensity = 0;
    wallMat.needsUpdate = true;

    floor.material.map = floorTexDay;
    floor.material.needsUpdate = true;

    trimMat.color.set(0x31545c);
    ground.material.color.set(0x8d9b8f);
    waterMat.color.set(0xc8efff);
    waterMat.emissiveIntensity = 0.25;

    hemi.color.set(0xffffff);
    hemi.groundColor.set(0xc0b49d);
    hemi.intensity = 2.4;

    dirLight.color.set(0xfff1d6);
    dirLight.intensity = 2.6;

    renderer.toneMappingExposure = 1.05;
    scene.fog.color.set(0xcfe6f2);
    scene.fog.density = 0.004;

    previewFill.visible = true;
    previewFill.intensity = 0.8;

    sunGroup.visible = false;
    moonSprite.visible = false;
    starField.visible = false;

    ball.material.emissiveIntensity = 0.2;
    dust.material.opacity = 0.12;
  }

  function updatePreviewCountdown() {
    if (mode !== "preview") return;
    const seconds = Math.max(0, Math.ceil((previewEndsAt - performance.now()) / 1000));
    previewCountEl.textContent = String(seconds);
    if (seconds <= 0) finishPreview();
  }

  function beginPreview() {
    mode = "preview";
    time = 0;
    keys.clear();
    closeBallPanel();
    hideHint();

    hud.classList.add("hidden");
    previewUi.classList.remove("hidden");
    previewLevelEl.textContent = String(level);
    previewEndsAt = performance.now() + 30000;
    previewCountEl.textContent = "30";

    buildPreviewMarkers();
    applyPreviewMapLook();

    camera.position.set(0, 88, 0.2);
    camera.lookAt(0, 0, 0);

    clearTimeout(previewTimer);
    clearInterval(previewInterval);
    previewTimer = setTimeout(finishPreview, 30000);
    previewInterval = setInterval(updatePreviewCountdown, 200);
    updateHintButton();
  }

  function finishPreview() {
    if (mode !== "preview") return;

    clearTimeout(previewTimer);
    clearInterval(previewInterval);
    previewTimer = null;
    previewInterval = null;

    mode = "playing";
    time = 0;
    keys.clear();

    previewUi.classList.add("hidden");
    clearPreviewMarkers();
    hud.classList.remove("hidden");

    applyTheme(theme);

    updateHud();
    updateCamera(1, true);
    updateHintButton();
  }

  function startGame() {
    overlay.classList.add("hidden");
    winOverlay.classList.add("hidden");
    loseOverlay.classList.add("hidden");
    resetBall();
    beginPreview();
  }

  function restartSame() {
    winOverlay.classList.add("hidden");
    loseOverlay.classList.add("hidden");
    overlay.classList.add("hidden");
    resetBall();
    beginPreview();
  }

  function newMazeAndPlay() {
    buildMaze();
    winOverlay.classList.add("hidden");
    loseOverlay.classList.add("hidden");
    overlay.classList.add("hidden");
    beginPreview();
  }

  function completeLevel() {
    if (mode !== "playing") return;

    mode = "transition";
    keys.clear();
    vel.set(0, 0);
    hideHint();

    const previousBest = bestByLevel[level];
    const isRecord = typeof previousBest !== "number" || time < previousBest;

    if (isRecord) {
      bestByLevel[level] = time;
      localStorage.setItem("labirint.best.levels.v1", JSON.stringify(bestByLevel));
    }

    levelEyebrowEl.textContent = `УРОВЕНЬ ${level} ПРОЙДЕН`;
    levelTitleEl.textContent = `УРОВЕНЬ ${level + 1}`;
    winTimeEl.textContent = formatTime(time);
    winBestEl.textContent = isRecord ? "Новый рекорд!" : `Рекорд: ${formatTime(previousBest)}`;
    winBestEl.classList.toggle("record", isRecord);
    winOverlay.classList.remove("hidden");
    updateHud();
    updateHintButton();

    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(advanceLevel, 1600);
  }

  function advanceLevel() {
    if (winOverlay.classList.contains("hidden")) return;
    clearTimeout(transitionTimer);
    transitionTimer = null;

    winOverlay.classList.add("hidden");
    loseOverlay.classList.add("hidden");
    level += 1;
    time = 0;
    keysCollected = 0;
    keys.clear();
    buildMaze();
    beginPreview();
  }

  function formatTime(t) {
    const total = Math.max(0, t);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const tenths = Math.floor((total * 10) % 10);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
  }

  function updateHud() {
    timerEl.textContent = formatTime(time);
    levelEl.textContent = String(level);

    const best = bestByLevel[level];
    bestEl.textContent = typeof best === "number" ? formatTime(best) : "—";

    const pips = keyPipsEl.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].classList.toggle("filled", i < keysCollected);
    }
    keyPipsEl.setAttribute("aria-label", `Собрано ключей: ${keysCollected} из ${KEY_COUNT}`);
  }

  function showToast(text, tone = "") {
    clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.className = "toast show" + (tone ? ` ${tone}` : "");
    toastTimer = setTimeout(() => {
      toastEl.className = "toast";
    }, 1900);
  }

  // ---------- Окно «Как играть» ----------
  function openHelp() {
    if (helpOpen) return;
    helpOpen = true;
    helpOpenedAt = performance.now();
    keys.clear();
    closeBallPanel();
    helpOverlay.classList.remove("revealed");
    helpOverlay.classList.add("open");
    helpBtn.setAttribute("aria-expanded", "true");
    clearTimeout(helpRevealTimer);
    helpRevealTimer = setTimeout(() => helpOverlay.classList.add("revealed"), 1300);
  }

  function closeHelp() {
    if (!helpOpen) return;
    helpOpen = false;
    clearTimeout(helpRevealTimer);
    helpRevealTimer = null;
    helpOverlay.classList.remove("open");
    helpOverlay.classList.remove("revealed");
    helpBtn.setAttribute("aria-expanded", "false");
    if (hintState) {
      hintState.until += performance.now() - helpOpenedAt;
    }
  }

  // ---------- Подсказка ----------
  function updateHintButton() {
    hintCountEl.textContent = String(hintsLeft);
    hintBtn.disabled = hintsLeft <= 0 || mode !== "playing";
    hintBtn.setAttribute("aria-label", `Подсказка, осталось ${hintsLeft}`);
  }

  function hideHint() {
    hintState = null;
    hintPathGroup.visible = false;
    while (hintPathGroup.children.length) {
      hintPathGroup.remove(hintPathGroup.children[0]);
    }
  }

  function ballGridCell() {
    const gx = Math.round(ball.position.x / CELL + (COLS - 1) / 2);
    const gy = Math.round(ball.position.z / CELL + (ROWS - 1) / 2);
    return {
      x: Math.max(1, Math.min(COLS - 2, gx)),
      y: Math.max(1, Math.min(ROWS - 2, gy)),
    };
  }

  function buildHintPathArrows(startCell, targetCell, distToTarget) {
    while (hintPathGroup.children.length) {
      hintPathGroup.remove(hintPathGroup.children[0]);
    }

    const path = [startCell];
    let cell = { ...startCell };
    let guard = 0;

    while ((cell.x !== targetCell.x || cell.y !== targetCell.y) && guard++ < 600) {
      const d = distToTarget[cell.y]?.[cell.x];
      if (d === undefined || d <= 0) break;

      let next = null;
      const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of neighbors) {
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (distToTarget[ny][nx] === d - 1) {
          next = { x: nx, y: ny };
          break;
        }
      }
      if (!next) break;
      cell = next;
      path.push(cell);
    }

    let count = 0;
    const maxArrows = 30;

    for (let i = 0; i < path.length - 1 && count < maxArrows; i += 2) {
      const a = path[i];
      const b = path[i + 1];
      const dirX = Math.sign(b.x - a.x);
      const dirZ = Math.sign(b.y - a.y);

      let wall = null;
      const sides =
        dirX !== 0
          ? [
              { x: 0, y: -1 },
              { x: 0, y: 1 },
            ]
          : [
              { x: -1, y: 0 },
              { x: 1, y: 0 },
            ];

      for (const side of sides) {
        const wx = a.x + side.x;
        const wy = a.y + side.y;
        if (maze.grid[wy]?.[wx] === 1) {
          wall = { x: wx, y: wy };
          break;
        }
      }

      let px;
      let py;
      let pz;

      if (wall) {
        const w = cellToWorld(wall.x, wall.y);
        px = w.x;
        py = WALL_H + 0.04;
        pz = w.z;
      } else {
        const w = cellToWorld(a.x, a.y);
        px = w.x;
        py = 0.085;
        pz = w.z;
      }

      const arrow = new THREE.Mesh(hintArrowGeo, hintPathMat);
      arrow.position.set(px, py, pz);
      arrow.rotation.y = Math.atan2(-dirX, -dirZ);
      arrow.scale.setScalar(0.62);
      hintPathGroup.add(arrow);
      count += 1;
    }

    return count;
  }

  function useHint() {
    if (mode !== "playing" || hintsLeft <= 0 || !maze) return;

    const passable = makePassable(maze.grid, maze.river);
    const startCell = ballGridCell();
    const dist = bfsDistancesFrom(startCell.x, startCell.y, passable);

    let target = null;
    let targetType = null;

    for (const item of keyItems) {
      if (item.collected || !item.cell) continue;
      const d = dist[item.cell.y]?.[item.cell.x];
      if (d === undefined || d < 0) continue;
      if (!target || d < target.dist) {
        target = { dist: d, cell: item.cell, item };
        targetType = "key";
      }
    }

    const goalDist = dist[GOAL_CELL.y][GOAL_CELL.x];
    if (keysCollected >= KEY_COUNT && goalDist >= 0) {
      target = { dist: goalDist, cell: GOAL_CELL, item: null };
      targetType = "goal";
    }

    if (!target) {
      showToast("Путь пока не найден", "warn");
      return;
    }

    if (target.dist === 0) {
      showToast("Цель уже рядом", "good");
      return;
    }

    const distToTarget = bfsDistancesFrom(target.cell.x, target.cell.y, passable);
    const arrowCount = buildHintPathArrows(startCell, target.cell, distToTarget);

    if (arrowCount === 0) {
      showToast("Путь пока не найден", "warn");
      return;
    }

    hintsLeft -= 1;
    hintState = {
      targetType,
      targetItem: target.item,
      until: performance.now() + 15000,
    };
    hintPathMat.opacity = 0.95;
    hintPathGroup.visible = true;
    updateHintButton();
    showToast(
      targetType === "key"
        ? `Ближайший ключ — ${target.dist} шагов. Стрелки на стенах — 15 сек.`
        : `Выход — ${target.dist} шагов. Стрелки на стенах — 15 сек.`,
      "good"
    );
  }

  function updateHintPath() {
    if (helpOpen) return;
    if (!hintState || mode !== "playing") {
      if (hintPathGroup.visible) hideHint();
      return;
    }

    const now = performance.now();
    if (now > hintState.until) {
      hideHint();
      return;
    }
    if (hintState.targetType === "key" && hintState.targetItem && hintState.targetItem.collected) {
      hideHint();
      return;
    }

    const remaining = hintState.until - now;
    hintPathMat.opacity = Math.min(0.95, (remaining / 1500) * 0.95);
  }

  // ---------- Тема ----------
  function applyTheme(next) {
    theme = next === "day" ? "day" : "night";
    localStorage.setItem("labirint.theme", theme);

    const day = theme === "day";

    scene.background = day ? skyTexDay : skyTexNight;
    scene.fog.color.set(day ? 0xcfe6f2 : 0x081120);
    scene.fog.density = day ? 0.058 : 0.07;

    hemi.color.set(day ? 0xffffff : 0x9ac4ff);
    hemi.groundColor.set(day ? 0xc0b49d : 0x121a26);
    hemi.intensity = day ? 2.1 : 1.7;

    dirLight.color.set(day ? 0xfff1d6 : 0xcfe6ff);
    dirLight.intensity = day ? 3.0 : 2.1;

    wallMat.map = day ? wallTexDay : wallTexNight;
    wallMat.color.set(day ? 0xffffff : 0xb8c9dd);
    wallMat.emissive.set(day ? 0x000000 : 0x07111c);
    wallMat.emissiveIntensity = day ? 0 : 0.9;
    wallMat.needsUpdate = true;

    floor.material.map = day ? floorTexDay : floorTexNight;
    floor.material.needsUpdate = true;

    trimMat.color.set(day ? 0x31545c : 0x2a6678);
    ground.material.color.set(day ? 0x97a089 : 0x04070c);
    waterMat.color.set(day ? 0xc8efff : 0xe4f4ff);
    waterMat.emissiveIntensity = day ? 0.25 : 0.7;
    pitRimMat.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending;

    ballLight.intensity = day ? 3 : 16;
    camLight.intensity = day ? 12 : 26;
    ball.material.emissiveIntensity = day ? 0.2 : 0.32;
    dust.material.color.set(day ? 0xffffff : 0x9fd2ff);
    dust.material.opacity = day ? 0.14 : 0.55;

    goalLightBase = day ? 10 : 16;
    goalLightPulse = day ? 8 : 14;

    renderer.toneMappingExposure = day ? 1.0 : 1.25;

    dayBtn.classList.toggle("active", day);
    nightBtn.classList.toggle("active", !day);
    dayBtn.setAttribute("aria-pressed", String(day));
    nightBtn.setAttribute("aria-pressed", String(!day));

    if (mode === "preview") {
      applyPreviewMapLook();
    } else {
      sunGroup.visible = day;
      moonSprite.visible = !day;
      starField.visible = !day;
      previewFill.visible = false;
    }
  }

  // ---------- Настройка мячика ----------
  function ballPreviewUrl(texture) {
    if (!texture || !texture.image) return "";
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 80;
    c.getContext("2d").drawImage(texture.image, 0, 0, 160, 80);
    return c.toDataURL("image/png");
  }

  function syncBallUI() {
    const url = ballPreviewUrl(ball.material.map);
    if (url) {
      ballIconEl.style.backgroundImage = `url("${url}")`;
      ballPreviewEl.style.backgroundImage = `url("${url}")`;
    }
    if (ballCustomColor.value.toLowerCase() !== ballColor) {
      ballCustomColor.value = ballColor;
    }
    for (const el of ballColorGrid.children) {
      el.classList.toggle("selected", el.dataset.color === ballColor);
    }
    for (const el of ballPatternGrid.children) {
      el.classList.toggle("active", el.dataset.pattern === ballPattern);
    }
  }

  function saveBallStyle() {
    localStorage.setItem("labirint.ball.v1", JSON.stringify({ color: ballColor, pattern: ballPattern }));
  }

  function applyBallStyle(save = true) {
    const old = ball.material.map;
    const tex = makeBallTexture(ballColor, ballPattern);
    ball.material.map = tex;
    ball.material.emissive.set(shade(ballColor, -0.1));
    ball.material.needsUpdate = true;

    ballLight.color.set(shade(ballColor, 0.18));

    if (old) old.dispose();
    if (save) saveBallStyle();
    syncBallUI();
  }

  function setBallColor(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    ballColor = color.toLowerCase();
    applyBallStyle();
  }

  function setBallPattern(pattern) {
    if (!BALL_PATTERNS.some((p) => p.id === pattern)) return;
    ballPattern = pattern;
    applyBallStyle();
  }

  function closeBallPanel() {
    ballPanel.classList.remove("open");
    ballBtn.setAttribute("aria-expanded", "false");
  }

  function initBallControls() {
    for (const item of BALL_PALETTE) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-swatch";
      btn.dataset.color = item.color;
      btn.title = item.name;
      btn.setAttribute("aria-label", item.name);
      btn.style.background = item.color;
      btn.addEventListener("click", () => setBallColor(item.color));
      ballColorGrid.appendChild(btn);
    }

    for (const item of BALL_PATTERNS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pattern-btn";
      btn.dataset.pattern = item.id;
      btn.textContent = item.label;
      btn.addEventListener("click", () => setBallPattern(item.id));
      ballPatternGrid.appendChild(btn);
    }

    ballCustomColor.addEventListener("input", () => setBallColor(ballCustomColor.value));

    ballBtn.addEventListener("click", () => {
      const open = ballPanel.classList.toggle("open");
      ballBtn.setAttribute("aria-expanded", String(open));
    });
    ballCloseBtn.addEventListener("click", closeBallPanel);

    document.addEventListener("pointerdown", (e) => {
      if (!ballPanel.classList.contains("open")) return;
      if (ballPanel.contains(e.target) || ballBtn.contains(e.target)) return;
      closeBallPanel();
    });

    applyBallStyle(false);
  }

  // ---------- Физика ----------
  function resolveCollisions(pos, v) {
    const r2 = BALL_R * BALL_R;

    for (let i = 0; i < maze.walls.length; i++) {
      const w = maze.walls[i];

      // быстрый отсев
      if (
        pos.x + BALL_R < w.minX ||
        pos.x - BALL_R > w.maxX ||
        pos.z + BALL_R < w.minZ ||
        pos.z - BALL_R > w.maxZ
      ) {
        continue;
      }

      const nx = Math.max(w.minX, Math.min(pos.x, w.maxX));
      const nz = Math.max(w.minZ, Math.min(pos.z, w.maxZ));
      let dx = pos.x - nx;
      let dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;

      if (d2 >= r2) continue;

      let d = Math.sqrt(d2);

      if (d < 1e-5) {
        // шарик глубоко в стене — выталкиваем по ближайшей грани
        const toLeft = pos.x - w.minX;
        const toRight = w.maxX - pos.x;
        const toBack = pos.z - w.minZ;
        const toFront = w.maxZ - pos.z;
        const min = Math.min(toLeft, toRight, toBack, toFront);

        if (min === toLeft) {
          pos.x = w.minX - BALL_R;
          if (v.x > 0) v.x = 0;
        } else if (min === toRight) {
          pos.x = w.maxX + BALL_R;
          if (v.x < 0) v.x = 0;
        } else if (min === toBack) {
          pos.z = w.minZ - BALL_R;
          if (v.z > 0) v.z = 0;
        } else {
          pos.z = w.maxZ + BALL_R;
          if (v.z < 0) v.z = 0;
        }
        continue;
      }

      const inx = dx / d;
      const inz = dz / d;
      const push = BALL_R - d;

      pos.x += inx * push;
      pos.z += inz * push;

      const vn = v.x * inx + v.z * inz;
      if (vn < 0) {
        v.x -= inx * vn * 1.3;
        v.z -= inz * vn * 1.3;
        v.x *= 0.985;
        v.z *= 0.985;
      }
    }
  }

  function isOverPit(x, z) {
    if (!maze) return false;
    const detectR = PIT_RADIUS * 0.9;
    for (const pit of maze.pits) {
      const dx = x - pit.world.x;
      const dz = z - pit.world.z;
      if (dx * dx + dz * dz < detectR * detectR) return true;
    }
    return false;
  }

  function isOverRiver(x, z) {
    if (!maze || !maze.river) return false;
    const r = maze.river;
    if (z < r.zMin + 0.02 || z > r.zMax - 0.02) return false;
    if (x < -45 || x > 45) return false;
    for (const bridge of r.bridges) {
      if (Math.abs(x - bridge.x) <= 0.72) return false;
    }
    return true;
  }

  function hazardAt(x, z) {
    if (isOverRiver(x, z)) return "river";
    if (isOverPit(x, z)) return "pit";
    return null;
  }

  function stepPhysics(dt) {
    const turn =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const drive =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);

    // A/D поворачивают шарик (и камеру) — камера всегда остаётся за ним
    if (turn !== 0) {
      camYaw -= turn * TURN_RATE * dt;
    }

    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);

    if (drive !== 0) {
      vel.x += fx * drive * ACCEL * dt;
      vel.y += fz * drive * ACCEL * dt;
    } else {
      const drag = Math.exp(-3.4 * dt);
      vel.x *= drag;
      vel.y *= drag;
    }

    // небольшое постоянное сопротивление
    const rollDrag = Math.exp(-0.5 * dt);
    vel.x *= rollDrag;
    vel.y *= rollDrag;

    const speed = vel.length();
    if (speed > MAX_SPEED) {
      vel.multiplyScalar(MAX_SPEED / speed);
    }

    ball.position.x += vel.x * dt;
    ball.position.z += vel.y * dt;

    resolveCollisions(ball.position, vel);

    // прыжок
    if (jumpRequested) {
      if (grounded) {
        ballVY = JUMP_VELOCITY;
        grounded = false;
      }
      jumpRequested = false;
    }

    if (!grounded) {
      ballVY -= GRAVITY * dt;
      ballY += ballVY * dt;

      if (ballY <= GROUND_Y) {
        ballY = GROUND_Y;
        ballVY = 0;
        grounded = true;
        const hazard = hazardAt(ball.position.x, ball.position.z);
        if (hazard) {
          startFall(hazard);
          return;
        }
      }
    }

    ball.position.y = ballY;

    if (grounded) {
      const hazard = hazardAt(ball.position.x, ball.position.z);
      if (hazard) {
        startFall(hazard);
        return;
      }
    }

    // вращение шарика
    const sp = vel.length();
    if (sp > 0.002) {
      const axis = new THREE.Vector3(vel.y, 0, -vel.x).normalize();
      const angle = (sp * dt) / BALL_R;
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      ball.quaternion.premultiply(q);
    }

    // сбор ключей
    for (const item of keyItems) {
      if (item.collected || !item.group.visible) continue;
      const dx = ball.position.x - item.group.position.x;
      const dz = ball.position.z - item.group.position.z;
      if (dx * dx + dz * dz < 0.8 * 0.8) {
        collectKey(item);
      }
    }

    // проверка выхода
    if (maze) {
      const gx = ball.position.x - maze.goal.x;
      const gz = ball.position.z - maze.goal.z;
      if (gx * gx + gz * gz < EXIT_RADIUS * EXIT_RADIUS) {
        if (keysCollected >= KEY_COUNT) {
          completeLevel();
        } else if (performance.now() - lastLockedNotice > 2000) {
          lastLockedNotice = performance.now();
          showToast(`Выход заперт — нужно ${KEY_COUNT} ключа (${keysCollected}/${KEY_COUNT})`, "warn");
        }
      }
    }
  }

  // ---------- Камера ----------
  const camDesired = new THREE.Vector3();
  const camTargetLook = new THREE.Vector3();

  function updateCamera(dt, snap = false) {
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);

    camDesired.set(
      ball.position.x - fx * CAM_DIST,
      GROUND_Y + CAM_HEIGHT,
      ball.position.z - fz * CAM_DIST
    );

    camTargetLook.set(
      ball.position.x + fx * CAM_LOOK_AHEAD,
      GROUND_Y + 0.55,
      ball.position.z + fz * CAM_LOOK_AHEAD
    );

    if (snap) {
      camera.position.copy(camDesired);
      camLook.copy(camTargetLook);
    } else {
      const posK = 1 - Math.exp(-25 * dt);
      const lookK = 1 - Math.exp(-20 * dt);
      camera.position.lerp(camDesired, posK);
      camLook.lerp(camTargetLook, lookK);
    }

    camera.lookAt(camLook);
  }

  // ---------- Ввод ----------
  const movementKeys = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);

  window.addEventListener("keydown", (e) => {
    if (
      movementKeys.has(e.code) ||
      e.code === "Space" ||
      e.code === "KeyR" ||
      e.code === "KeyN"
    ) {
      e.preventDefault();
    }

    if (helpOpen) {
      if (e.code === "Escape") closeHelp();
      return;
    }

    if (e.code === "Escape") {
      closeBallPanel();
      return;
    }

    if (mode === "falling") return;

    if (mode === "lost") {
      if (e.code === "KeyR" || e.code === "Space" || e.code === "Enter") {
        restartSame();
      } else if (e.code === "KeyN") {
        newMazeAndPlay();
      }
      return;
    }

    if (mode === "preview") {
      if (e.code === "Space" || e.code === "Enter") finishPreview();
      return;
    }

    if (e.code === "Space") {
      if (mode === "menu") {
        startGame();
        return;
      }
      if (mode === "playing" && !e.repeat && grounded) {
        jumpRequested = true;
      }
      return;
    }

    if (mode === "transition") return;

    if (e.code === "KeyR") {
      if (mode === "menu") startGame();
      else restartSame();
      return;
    }

    if (e.code === "KeyN") {
      newMazeAndPlay();
      return;
    }

    if (mode === "menu") {
      startGame();
    }

    keys.add(e.code);
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });

  window.addEventListener("blur", () => {
    keys.clear();
  });

  startBtn.addEventListener("click", () => startGame());
  againBtn.addEventListener("click", () => advanceLevel());
  loseBtn.addEventListener("click", () => restartSame());
  dayBtn.addEventListener("click", () => applyTheme("day"));
  nightBtn.addEventListener("click", () => applyTheme("night"));
  hintBtn.addEventListener("click", () => useHint());
  previewSkipBtn.addEventListener("click", () => finishPreview());
  helpBtn.addEventListener("click", () => openHelp());
  helpCloseBtn.addEventListener("click", () => closeHelp());
  helpOverlay.addEventListener("pointerdown", (e) => {
    if (e.target === helpOverlay) closeHelp();
  });

  // ---------- Ресайз ----------
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- Цикл ----------
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (mode === "playing" && !helpOpen) {
      time += dt;

      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      for (let i = 0; i < steps && mode === "playing"; i++) {
        stepPhysics(h);
      }

      updateHud();
      updateCamera(dt);
    } else if (mode === "falling" && !helpOpen) {
      ballVY -= 24 * dt;
      ballY += ballVY * dt;
      ball.position.y = ballY;
      ball.rotation.x += dt * 1.5;
      updateCamera(dt);
    } else if (mode === "preview") {
      // камера уже смотрит на всю карту
    } else {
      updateCamera(dt);
    }

    // анимация выхода
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    goalPad.material.opacity = 0.32 + pulse * 0.3;
    const ringScale = 1 + pulse * 0.07;
    goalRing.scale.setScalar(ringScale);
    goalLight.intensity = goalLightBase + pulse * goalLightPulse;

    // ключи парят и вращаются
    keyItems.forEach((item, i) => {
      if (!item.group.visible) return;
      item.crystal.rotation.y = t * 1.35 + i * 1.7;
      item.crystal.rotation.x = Math.sin(t * 1.1 + i) * 0.18;
      item.crystal.position.y = 0.75 + Math.sin(t * 2.2 + i * 2.1) * 0.09;
      item.ring.scale.setScalar(1 + Math.sin(t * 3 + i * 1.4) * 0.08);
      item.light.intensity = 7 + Math.sin(t * 3.2 + i * 2) * 2;
    });

    // вода и кромки ям
    waterTex.offset.x = (t * 0.015) % 1;
    waterTex.offset.y = Math.sin(t * 0.5) * 0.015;
    pitRimMat.opacity = 0.55 + pulse * 0.35;

    updateHintPath();

    // небо следует за камерой, как бесконечно далёкое
    skyGroup.position.copy(camera.position);

    // пыль медленно плывёт
    dust.rotation.y = t * 0.008;

    renderer.render(scene, camera);
  }

  // ---------- Отладочный доступ (можно удалить) ----------
  window.__lab = {
    THREE,
    scene,
    camera,
    renderer,
    ball,
    startGame,
    restartSame,
    newMazeAndPlay,
    teleport: (x, z, yaw) => {
      ball.position.set(x, GROUND_Y, z);
      ballY = GROUND_Y;
      ballVY = 0;
      grounded = true;
      ball.quaternion.identity();
      vel.set(0, 0);
      if (typeof yaw === "number") camYaw = yaw;
      updateCamera(1, true);
    },
    setKeys: (codes) => {
      keys.clear();
      for (const c of codes) keys.add(c);
    },
    jump: () => {
      jumpRequested = true;
    },
    collectAllKeys: () => {
      for (const item of keyItems) {
        if (!item.collected) collectKey(item);
      }
    },
    useHint,
    getHintInfo: () => ({
      hintsLeft,
      active: !!hintState,
      pathVisible: hintPathGroup.visible,
      arrowCount: hintPathGroup.children.length,
      targetType: hintState ? hintState.targetType : null,
      remaining: hintState ? Math.max(0, hintState.until - performance.now()) : 0,
    }),
    debugStep: (dt) => stepPhysics(dt),
    debugCamera: (dt) => updateCamera(dt),
    getMaze: () => maze,
    getState: () => ({
      mode,
      level,
      time,
      camYaw,
      ball: { x: ball.position.x, y: ball.position.y, z: ball.position.z },
      vel: { x: vel.x, z: vel.y },
      grounded,
      keysCollected,
      hintsLeft,
      wallCount: maze ? maze.walls.length : 0,
      pitCount: maze ? maze.pits.length : 0,
      bridges: maze && maze.river ? maze.river.bridges.length : 0,
      goal: maze ? maze.goal : null,
      bestTime: bestByLevel[level] ?? null,
    }),
  };

  // ---------- Старт ----------
  applyTheme(theme);
  initBallControls();
  buildMaze();
  updateHud();
  updateCamera(1, true);
  animate();
})();
