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

  const CHARACTERS = [
    { id: "ball", label: "Мяч", icon: "⚽", accent: "#ffd23f" },
    { id: "cat", label: "Кошка", icon: "🐱", accent: "#b58e68" },
    { id: "dog", label: "Собака", icon: "🐶", accent: "#a97a50" },
    { id: "lion", label: "Лев", icon: "🦁", accent: "#e0a94b" },
    { id: "tiger", label: "Тигр", icon: "🐯", accent: "#f08a2f" },
    { id: "leopard", label: "Леопард", icon: "🐆", accent: "#e5c37b" },
  ];

  let playerKind = localStorage.getItem("labirint.player.v1") || "ball";
  if (!CHARACTERS.some((c) => c.id === playerKind)) playerKind = "ball";

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
  const fpsEl = document.getElementById("fps");
  let fpsExpanded = false, fpsCompactText = '? fps', fpsDetailedText = '? fps';
  fpsEl?.addEventListener('click', event => {
    event.stopPropagation();
    fpsExpanded = !fpsExpanded;
    fpsEl.setAttribute('aria-expanded', String(fpsExpanded));
    fpsEl.textContent = fpsExpanded ? fpsDetailedText : fpsCompactText;
  });
  const timerEl = document.getElementById("timer");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const keyPipsEl = document.getElementById("keyPips");
  const boostFillEl = document.getElementById("boostFill");
  const boostBlockEl = boostFillEl ? boostFillEl.closest(".hud-boost") : null;
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
  const characterGrid = document.getElementById("characterGrid");
  const ballStyleSection = document.getElementById("ballStyleSection");
  const ballCustomColor = document.getElementById("ballCustomColor");
  const ballCloseBtn = document.getElementById("ballClose");

  // ---------- Рендерер и сцена ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });

  // Разрешение рендера подстраивается под время отрисовки (см. adaptRenderScale).
  const MAX_RENDER_SCALE = Math.min(window.devicePixelRatio || 1, 1.5);
  const MIN_RENDER_SCALE = 0.7;
  let renderScale = MAX_RENDER_SCALE;
  let appliedRenderScale = renderScale;
  let appliedWidth = window.innerWidth;
  let appliedHeight = window.innerHeight;
  renderer.setPixelRatio(renderScale);
  renderer.setSize(appliedWidth, appliedHeight);
  renderer.shadowMap.enabled = true;
  // PCFSoft: 16 выборок на фрагмент против 17 у PCF — дешевле и мягче.
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Мир статичен: карту теней печём один раз на уровень, а не каждый кадр
  // (это был самый дорогой проход — ~27 мс на кадр по замерам).
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
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

  // Тени: мир статичен, поэтому карта теней рендерится один раз на уровень
  // (renderer.shadowMap.autoUpdate = false + needsUpdate в buildMaze).
  // Раз это разовая работа, можно позволить 2048² и весь лабиринт целиком.
  const SHADOW_MAP_SIZE = 2048;
  const SHADOW_HALF = 55;
  const SHADOW_DIR = new THREE.Vector3(18, 28, 12);

  const dirLight = new THREE.DirectionalLight(0xcfe6ff, 2.1);
  dirLight.position.copy(SHADOW_DIR);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  dirLight.shadow.camera.left = -SHADOW_HALF;
  dirLight.shadow.camera.right = SHADOW_HALF;
  dirLight.shadow.camera.top = SHADOW_HALF;
  dirLight.shadow.camera.bottom = -SHADOW_HALF;
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

  // ---------- Текстуры ----------
  function makeFloorTexture(day) {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const g = c.getContext("2d");
    g.scale(4, 4); // Paint in the original coordinates, with smooth high-resolution colour.
    const reliefSize = 1024;
    const heights = new Float32Array(reliefSize * reliefSize);
    // Physical heights wrap around the tile, just like the painted motifs.
    function addRelief(x, y, rx, ry, angle, amount) {
      const factor=reliefSize/256;
      x*=factor; y*=factor; rx*=factor; ry*=factor;
      const radius = Math.ceil(Math.max(rx, ry)), co = Math.cos(angle), si = Math.sin(angle);
      for (let py = Math.floor(y-radius); py <= Math.ceil(y+radius); py++) {
        for (let px = Math.floor(x-radius); px <= Math.ceil(x+radius); px++) {
          const dx=px+.5-x, dy=py+.5-y;
          const d=((dx*co+dy*si)/rx)**2+((-dx*si+dy*co)/ry)**2;
          if(d>=1)continue;
          const smooth=(1-d)*(1-d);
          heights[((py%reliefSize+reliefSize)%reliefSize)*reliefSize+(px%reliefSize+reliefSize)%reliefSize]+=amount*smooth;
        }
      }
    }

    g.fillStyle = day ? "#b3a283" : "#2a2720";
    g.fillRect(0, 0, 256, 256);

    // мягкие пятна земли
    const wrapped = (x, y, radius, draw) => {
      const xs = [0], ys = [0];
      if (x - radius < 0) xs.push(256);
      if (x + radius > 256) xs.push(-256);
      if (y - radius < 0) ys.push(256);
      if (y + radius > 256) ys.push(-256);
      for (const dx of xs) for (const dy of ys) {
        g.save(); g.translate(dx, dy); draw(); g.restore();
      }
    };
    for (let i = 0; i < 55; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 14 + Math.random() * 42;
      const tint = day
        ? (Math.random() > .5 ? "rgba(123,108,82,.16)" : "rgba(210,196,166,.16)")
        : (Math.random() > .5 ? "rgba(18,20,16,.35)" : "rgba(64,63,52,.18)");
      addRelief(x, y, r, r, 0, i % 2 ? .012 : -.009);
      wrapped(x, y, r, () => {
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, tint);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      });
    }

    // камешки и сухая трава
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      if (Math.random() < 0.22) {
        g.strokeStyle = day ? "rgba(99, 112, 72, 0.5)" : "rgba(55, 70, 46, 0.45)";
        g.lineWidth = 1;
        const tipX = x + (Math.random() - .5) * 3;
        const tipY = y - 2 - Math.random() * 3;
        wrapped(x, y, 6, () => {
          g.beginPath(); g.moveTo(x, y + 3); g.lineTo(tipX, tipY); g.stroke();
        });
      } else {
        const stone = day ? (Math.random() > 0.5 ? "#cfc4ad" : "#8e826c") : (Math.random() > 0.5 ? "#585347" : "#1b1c18");
        g.fillStyle = stone;
        g.globalAlpha = 0.35 + Math.random() * 0.45;
        const rx = 1 + Math.random() * 3, ry = .8 + Math.random() * 2, angle = Math.random() * Math.PI;
        addRelief(x, y, rx+.6, ry+.6, angle, .018+rx*.003);
        wrapped(x, y, 5, () => {
          g.beginPath(); g.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); g.fill();
        });
        g.globalAlpha = 1;
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // Scatter smooth grains at subpixel positions, without a square lattice
    // or axis-aligned filtering. The existing relief writer wraps every grain.
    let grainSeed=91273;
    const grainRandom=()=>((grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0)/4294967296);
    for(let grain=0;grain<6000;grain++) {
      const x=grainRandom()*256,y=grainRandom()*256;
      const radius=1.8+grainRandom()*2.8;
      const aspect=.75+grainRandom()*.5,angle=grainRandom()*Math.PI;
      const amount=(grainRandom()-.5)*.005;
      addRelief(x,y,radius,radius*aspect,angle,amount);
    }
    const normalCanvas=document.createElement("canvas");
    normalCanvas.width=normalCanvas.height=reliefSize;
    const normalContext=normalCanvas.getContext("2d"), pixels=normalContext.createImageData(reliefSize,reliefSize);
    const step=CELL*3/reliefSize;
    const at=(x,y)=>heights[((y+reliefSize)%reliefSize)*reliefSize+(x+reliefSize)%reliefSize];
    for(let y=0;y<reliefSize;y++)for(let x=0;x<reliefSize;x++) {
      const nx=(at(x-1,y)-at(x+1,y))/(2*step);
      const ny=(at(x,y+1)-at(x,y-1))/(2*step);
      const length=Math.hypot(nx,ny,1),i=(y*reliefSize+x)*4;
      pixels.data[i]=(nx/length*.5+.5)*255;
      pixels.data[i+1]=(ny/length*.5+.5)*255;
      pixels.data[i+2]=(1/length*.5+.5)*255;
      pixels.data[i+3]=255;
    }
    normalContext.putImageData(pixels,0,0);
    const normalMap=new THREE.CanvasTexture(normalCanvas);
    normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;
    normalMap.anisotropy=tex.anisotropy;
    tex.userData.normalMap=normalMap;
    return tex;
  }

  function makeFoliageTexture(normal = false) {
    const texture = new THREE.Texture();
    texture.name = "CC0 photographic hedge leaves";
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.colorSpace = normal ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const image = new Image();
    image.onload = () => { texture.image = image; texture.needsUpdate = true; };
    image.onerror = () => console.error("Hedge foliage texture failed to load");
    image.src = normal ? (window.HEDGE_NORMAL_DATA || "static/generated/hedge-leaves-normal.png") : (window.HEDGE_TEXTURE_DATA || "static/generated/hedge-leaves.jpg");
    return texture;
  }

  function makeLeafClusterTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");

    const drawLeaf = (x, y, angle, length, width, tone) => {
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.beginPath();
      g.moveTo(0, -length / 2);
      g.quadraticCurveTo(width, -length * 0.1, 0, length / 2);
      g.quadraticCurveTo(-width, -length * 0.1, 0, -length / 2);
      g.closePath();
      g.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
      g.fill();
      g.strokeStyle = "rgba(100, 100, 100, 0.45)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, -length * 0.45);
      g.lineTo(0, length * 0.45);
      g.stroke();
      g.restore();
    };

    for (let i = 0; i < 115; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 92;
      const x = 128 + Math.cos(angle) * dist;
      const y = 128 + Math.sin(angle) * dist;
      const tone = 170 + ((Math.random() * 85) | 0);
      drawLeaf(
        x,
        y,
        angle + Math.PI / 2 + (Math.random() - 0.5) * 1.4,
        9 + Math.random() * 17,
        3.5 + Math.random() * 5,
        tone
      );
    }

    const tex = new THREE.CanvasTexture(c);
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
    // Seamless normal field, baked once. Both animated layers share this map.
    const size = 256, pixels = new Uint8Array(size * size * 4);
    const heights = new Float32Array(size*size);
    const noise = (x,y,n) => {
      const ix=Math.floor(x),iy=Math.floor(y);
      const smooth=t=>t*t*t*(t*(t*6-15)+10);
      const fx=smooth(x-ix),fy=smooth(y-iy);
      const hash=(a,b)=>{let h=Math.imul(((a%n+n)%n)+7,374761393)^Math.imul(((b%n+n)%n)+13,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
      return (hash(ix,iy)*(1-fx)+hash(ix+1,iy)*fx)*(1-fy)+(hash(ix,iy+1)*(1-fx)+hash(ix+1,iy+1)*fx)*fy;
    };
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const u=x/size,v=y/size;
      const warpX=(noise(u*4,v*4,4)-.5)*2,warpY=(noise(u*4+1.7,v*4+.3,4)-.5)*2;
      heights[y*size+x]=noise(u*8+warpX,v*8+warpY,8)+.30*noise(u*17,v*17,17)+.10*noise(u*31,v*31,31);
    }
    const heightAt=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx=(heightAt(x-1,y)-heightAt(x+1,y))*2.5;
      const ny=(heightAt(x,y-1)-heightAt(x,y+1))*2.5;
      const length = Math.hypot(nx,ny,1), i = (y*size+x)*4;
      pixels[i] = (nx/length*.5+.5)*255;
      pixels[i+1] = (ny/length*.5+.5)*255;
      pixels[i+2] = (1/length*.5+.5)*255; pixels[i+3] = 255;
    }
    const tex = new THREE.DataTexture(pixels,size,size);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
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
    const width=256,height=512,heights=new Float32Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const px=(x+.5)/2,py=(y+.5)/2,row=py%32;
      const edge=Math.min(px-4,124-px,row-2,30-row);
      const k=Math.max(0,Math.min(1,edge/1.6));
      const bevel=k*k*(3-2*k);
      const grain=Math.sin(row*2.8+Math.sin(px*.06)*.7)*.0025;
      // Follow the four curved grain strokes painted on each board above.
      const t=Math.max(0,Math.min(1,(px-8)/112)),q=1-t;
      let grooves=0;
      for(let line=0;line<4;line++) {
        const strokeY=q*q*q*(8+line*6)+3*q*q*t*(4+line*6)+3*q*t*t*(12+line*6)+t*t*t*(7+line*6);
        grooves+=.005*Math.exp(-Math.pow((row-strokeY)/.8,2));
      }
      heights[y*width+x]=bevel*(.065+grain+grooves+.009*Math.sin(row*Math.PI/32));
    }
    const normalCanvas=document.createElement("canvas");
    normalCanvas.width=width;normalCanvas.height=height;
    const ng=normalCanvas.getContext("2d"),pixels=ng.createImageData(width,height);
    const at=(x,y)=>heights[Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x))];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const nx=(at(x-1,y)-at(x+1,y))/(2*1.5/width);
      const ny=(at(x,y+1)-at(x,y-1))/(2*7.8/height);
      const length=Math.hypot(nx,ny,1),i=(y*width+x)*4;
      pixels.data[i]=(nx/length*.5+.5)*255;
      pixels.data[i+1]=(ny/length*.5+.5)*255;
      pixels.data[i+2]=(1/length*.5+.5)*255;pixels.data[i+3]=255;
    }
    ng.putImageData(pixels,0,0);
    tex.userData.normalMap=new THREE.CanvasTexture(normalCanvas);
    tex.userData.normalMap.anisotropy=tex.anisotropy;
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

  const ANIMAL_PALETTES = {
    cat: {
      top: "#b99f80", mid: "#977a5d", bottom: "#6a503b",
      fur: "#977a5c", light: "#f1e2cc", dark: "#453226",
      ear: "#c98e7d", eye: "#85b35e", nose: "#cc7886", mane: null,
    },
    dog: {
      top: "#cba173", mid: "#a97a50", bottom: "#6f4b2e",
      fur: "#a97a4e", light: "#f6e5ca", dark: "#49301e",
      ear: "#6f482b", eye: "#6b4326", nose: "#2a211b", mane: null,
    },
    lion: {
      top: "#f0c46b", mid: "#dda94d", bottom: "#a66c27",
      fur: "#dca94d", light: "#fae6bd", dark: "#6b3a17",
      ear: "#cf9236", eye: "#c58c2e", nose: "#5d3420", mane: "#8d4a1d",
    },
    tiger: {
      top: "#ffc06a", mid: "#ee8a2b", bottom: "#ac4e10",
      fur: "#ee8a2b", light: "#fff0d0", dark: "#251a13",
      ear: "#df7f27", eye: "#8fbe58", nose: "#3b251a", mane: null,
    },
    leopard: {
      top: "#eed49a", mid: "#d9b266", bottom: "#a77d3b",
      fur: "#d9b266", light: "#fbf0d4", dark: "#2a2118",
      ear: "#c2964e", eye: "#9bae5b", nose: "#4a3122", mane: null,
    },
  };

  function drawAnimalEye(g, x, y, irisColor, darkColor) {
    g.fillStyle = "#fff9ea";
    g.beginPath();
    g.ellipse(x, y, 10, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = darkColor;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.2;
    g.stroke();
    g.globalAlpha = 1;

    g.fillStyle = irisColor;
    g.beginPath();
    g.ellipse(x, y, 6.5, 8, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#1d1510";
    g.beginPath();
    g.ellipse(x, y, 3.2, 5.2, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(x - 2, y - 3, 1.7, 0, Math.PI * 2);
    g.fill();
  }

  function drawAnimalFace(g, cx, cy, kind) {
    const p = ANIMAL_PALETTES[kind];
    const isLion = kind === "lion";
    const isDog = kind === "dog";
    const isTiger = kind === "tiger";
    const isLeopard = kind === "leopard";
    const isCat = kind === "cat";

    g.save();
    g.translate(cx, cy);
    g.lineJoin = "round";
    g.lineCap = "round";

    // львиная грива
    if (isLion) {
      g.fillStyle = p.mane;
      g.strokeStyle = "rgba(90,45,15,0.55)";
      g.lineWidth = 1.2;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const a2 = a + Math.PI / 18;
        g.beginPath();
        g.moveTo(Math.cos(a) * 35, Math.sin(a) * 35);
        g.lineTo(Math.cos(a) * 58, Math.sin(a) * 58);
        g.lineTo(Math.cos(a2) * 35, Math.sin(a2) * 35);
        g.closePath();
        g.fill();
        g.stroke();
      }
    }

    // уши
    if (isDog) {
      g.fillStyle = p.ear;
      for (const side of [-1, 1]) {
        g.save();
        g.translate(side * 37, -3);
        g.rotate(side * 0.22);
        g.beginPath();
        g.ellipse(0, 0, 13, 30, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    } else if (isLion) {
      g.fillStyle = p.fur;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.arc(side * 27, -33, 9, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      for (const side of [-1, 1]) {
        g.fillStyle = p.ear;
        g.beginPath();
        g.moveTo(side * 11, -29);
        g.lineTo(side * 37, -31);
        g.lineTo(side * 25, -57);
        g.closePath();
        g.fill();
        g.strokeStyle = p.dark;
        g.lineWidth = 1.4;
        g.stroke();

        g.fillStyle = p.light;
        g.beginPath();
        g.moveTo(side * 18, -32);
        g.lineTo(side * 31, -33);
        g.lineTo(side * 25, -49);
        g.closePath();
        g.fill();
      }
    }

    // голова
    const headRx = isLion ? 36 : isDog ? 38 : 40;
    const headRy = isLion ? 35 : 37;
    g.fillStyle = p.fur;
    g.beginPath();
    g.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(40,25,15,0.35)";
    g.lineWidth = 1.4;
    g.stroke();

    // светлая морда
    g.fillStyle = p.light;
    if (isDog) {
      g.beginPath();
      g.ellipse(0, 17, 21, 14, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(side * 8, 16, 13, 10, 0, 0, Math.PI * 2);
        g.fill();
      }
    }

    // глаза
    drawAnimalEye(g, -15, -3, p.eye, p.dark);
    drawAnimalEye(g, 15, -3, p.eye, p.dark);

    // пятно у собаки
    if (isDog) {
      g.fillStyle = "rgba(80,48,26,0.35)";
      g.beginPath();
      g.ellipse(-17, -6, 15, 13, -0.2, 0, Math.PI * 2);
      g.fill();
      drawAnimalEye(g, -15, -3, p.eye, p.dark);
      drawAnimalEye(g, 15, -3, p.eye, p.dark);
    }

    // полоски/пятна на морде
    g.strokeStyle = p.dark;
    if (isTiger) {
      g.lineWidth = 3.5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-10 + i * 10, -30);
        g.lineTo(-8 + i * 8, -14);
        g.stroke();
      }
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(side * (25 + i * 4), -8 + i * 8);
          g.lineTo(side * (38 + i * 2), -5 + i * 8);
          g.stroke();
        }
      }
      g.fillStyle = p.dark;
      g.beginPath();
      g.moveTo(-31, -49);
      g.lineTo(-20, -55);
      g.lineTo(-25, -43);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(31, -49);
      g.lineTo(20, -55);
      g.lineTo(25, -43);
      g.closePath();
      g.fill();
    } else if (isCat) {
      g.lineWidth = 2;
      g.globalAlpha = 0.55;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-9 + i * 9, -30);
        g.lineTo(-7 + i * 7, -18);
        g.stroke();
      }
      for (const side of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          g.beginPath();
          g.moveTo(side * (27 + i * 4), -2 + i * 7);
          g.lineTo(side * (37 + i * 2), -1 + i * 7);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
    } else if (isLeopard) {
      g.lineWidth = 2.2;
      const spots = [
        [-28, -22, 5], [-14, -27, 4], [8, -29, 4], [24, -22, 5],
        [-30, 4, 4], [29, 3, 4], [-20, 30, 4], [20, 30, 4],
      ];
      for (const [sx, sy, sr] of spots) {
        g.beginPath();
        g.arc(sx, sy, sr, 0.2, Math.PI * 1.7);
        g.stroke();
      }
    }

    // нос
    g.fillStyle = isCat ? p.nose : p.nose;
    if (isCat) {
      g.beginPath();
      g.moveTo(0, 10);
      g.lineTo(-6, 17);
      g.lineTo(6, 17);
      g.closePath();
      g.fill();
    } else {
      g.beginPath();
      g.ellipse(0, 12, 7, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.beginPath();
      g.ellipse(-2, 10.5, 2.3, 1.5, 0, 0, Math.PI * 2);
      g.fill();
    }

    // рот
    g.strokeStyle = "rgba(50,30,20,0.75)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, 17);
    g.quadraticCurveTo(-4, 23, -10, 22);
    g.moveTo(0, 17);
    g.quadraticCurveTo(4, 23, 10, 22);
    g.stroke();

    if (isDog) {
      g.fillStyle = "#d9777a";
      g.beginPath();
      g.ellipse(0, 27, 6, 8, 0, 0, Math.PI * 2);
      g.fill();
    }

    // усы
    if (!isDog) {
      g.strokeStyle = "rgba(255,250,235,0.8)";
      g.lineWidth = 1.2;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(side * 13, 17 + i * 2);
          g.lineTo(side * (36 + i * 3), 10 + i * 8);
          g.stroke();
        }
      }
    }

    g.restore();
  }

  function drawAnimalFur(g, kind, rnd) {
    const p = ANIMAL_PALETTES[kind];
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, p.top);
    grad.addColorStop(0.5, p.mid);
    grad.addColorStop(1, p.bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);

    if (kind === "tiger") {
      g.strokeStyle = "rgba(35,22,14,0.72)";
      g.lineWidth = 9;
      for (let i = 0; i < 9; i++) {
        const y = 18 + i * 27;
        g.beginPath();
        for (let x = -20; x <= 532; x += 10) {
          const py = y + Math.sin(x * 0.025 + i * 1.7) * 8;
          if (x === -20) g.moveTo(x, py);
          else g.lineTo(x, py);
        }
        g.stroke();
      }
    } else if (kind === "leopard") {
      g.strokeStyle = "rgba(40,29,20,0.7)";
      g.lineWidth = 2.6;
      for (let i = 0; i < 42; i++) {
        const x = rnd() * 512;
        const y = 18 + rnd() * 220;
        const r = 5 + rnd() * 6;
        g.beginPath();
        g.arc(x, y, r, rnd() * Math.PI, Math.PI * 1.7 + rnd());
        g.stroke();
        g.beginPath();
        g.arc(x + r * 0.8, y - r * 0.3, r * 0.6, 0, Math.PI * 1.5);
        g.stroke();
      }
    } else if (kind === "cat") {
      g.strokeStyle = "rgba(75,52,36,0.3)";
      g.lineWidth = 7;
      for (let i = 0; i < 8; i++) {
        const y = 12 + i * 31;
        g.beginPath();
        for (let x = -20; x <= 532; x += 10) {
          const py = y + Math.sin(x * 0.018 + i) * 7;
          if (x === -20) g.moveTo(x, py);
          else g.lineTo(x, py);
        }
        g.stroke();
      }
    } else if (kind === "dog") {
      g.fillStyle = "rgba(83,52,28,0.2)";
      for (let i = 0; i < 14; i++) {
        const x = rnd() * 512;
        const y = rnd() * 256;
        g.beginPath();
        g.ellipse(x, y, 10 + rnd() * 22, 8 + rnd() * 16, rnd() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === "lion") {
      g.fillStyle = "rgba(165, 96, 28, 0.14)";
      for (let i = 0; i < 20; i++) {
        const x = rnd() * 512;
        const y = rnd() * 256;
        g.beginPath();
        g.arc(x, y, 3 + rnd() * 7, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function drawAnimalPattern(g, kind, rnd) {
    drawAnimalFur(g, kind, rnd);
    drawAnimalFace(g, 0, 128, kind);
    drawAnimalFace(g, 512, 128, kind);
    drawAnimalFace(g, 256, 128, kind);
  }

  function makeFurTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#c9c9c9";
    g.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 520; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const len = 5 + Math.random() * 16;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const tone = 150 + ((Math.random() * 100) | 0);
      g.strokeStyle = `rgba(${tone}, ${tone}, ${tone}, ${0.18 + Math.random() * 0.3})`;
      g.lineWidth = 0.8 + Math.random() * 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      g.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function paintBallBase(g, top, mid, bottom) {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(0.5, mid);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
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
      paintBallBase(g, "#fdfbf4", "#f0eadb", "#d8cfba");
      // 12 чёрных пятиугольников в вершинах икосаэдра — как у настоящего мяча
      const p = (1 + Math.sqrt(5)) / 2;
      const vertices = [];
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) vertices.push([0, sy, sz * p]);
      }
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) vertices.push([sx, sy * p, 0]);
      }
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) vertices.push([sx * p, 0, sz]);
      }

      const patchFill = "#1b1b1b";
      const patchStroke = "rgba(255,255,255,0.7)";
      const radius = 20;

      vertices.forEach(([vx, vy, vz], index) => {
        const len = Math.hypot(vx, vy, vz);
        const x = vx / len;
        const y = vy / len;
        const z = vz / len;
        const lat = Math.asin(y);
        const lon = Math.atan2(x, z);
        const u = ((lon / (Math.PI * 2) + 0.5) % 1) * 512;
        const v = (0.5 - lat / Math.PI) * 256;
        const hScale = Math.min(2.15, 1 / Math.max(0.46, Math.cos(lat)));
        const rotation = index * 0.55;

        for (const offset of [-512, 0, 512]) {
          const cx = u + offset;
          if (cx < -radius * 3 || cx > 512 + radius * 3) continue;
          g.beginPath();
          for (let k = 0; k < 5; k++) {
            const a = rotation + (k * Math.PI * 2) / 5 - Math.PI / 2;
            const px = cx + Math.cos(a) * radius * hScale;
            const py = v + Math.sin(a) * radius;
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.fillStyle = patchFill;
          g.fill();
          g.strokeStyle = patchStroke;
          g.lineWidth = 2;
          g.stroke();
        }
      });

      // тонкие швы по поверхности
      g.strokeStyle = "rgba(70,70,70,0.15)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(-20, 34 + i * 62);
        g.bezierCurveTo(160, 90 + i * 50, 350, 160 - i * 38, 532, 218 - i * 58);
        g.stroke();
      }
    } else if (pattern === "basketball") {
      paintBallBase(g, "#ffb366", "#e87a23", "#a9470e");
      const seam = "#2b1709";
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
        g.fillStyle = "rgba(70,32,10,0.14)";
        g.beginPath();
        g.arc(rnd() * 512, rnd() * 256, 1.5 + rnd() * 1.5, 0, Math.PI * 2);
        g.fill();
      }
    } else if (pattern === "tennis") {
      paintBallBase(g, "#f2f77e", "#d9e548", "#a9b92c");
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
      g.strokeStyle = "#fffdf0";
      g.lineWidth = 6;
      drawSeam();

      // «ворс»
      for (let i = 0; i < 260; i++) {
        g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
        g.fillRect(rnd() * 512, rnd() * 256, 1.5, 1.5);
      }
    } else if (pattern === "volleyball") {
      paintBallBase(g, "#fefdf8", "#f3efe4", "#d9d4c4");
      const seam = "#ffffff";
      const panel = "rgba(58, 118, 166, 0.6)";
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
    } else if (
      pattern === "cat" ||
      pattern === "dog" ||
      pattern === "lion" ||
      pattern === "tiger" ||
      pattern === "leopard"
    ) {
      drawAnimalPattern(g, pattern, rnd);
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
  floorTexNight.repeat.set(COLS / 3, ROWS / 3);
  floorTexDay.repeat.set(COLS / 3, ROWS / 3);
  floorTexNight.userData.normalMap.repeat.copy(floorTexNight.repeat);
  floorTexDay.userData.normalMap.repeat.copy(floorTexDay.repeat);

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

  // ---------- Живые изгороди, кусты и домики ----------
  const foliageTex = makeFoliageTexture();
  const foliageNormal = makeFoliageTexture(true);
  const leafClusterTex = makeLeafClusterTexture();

  const hedgeBaseGeo = new THREE.BoxGeometry(CELL * 0.97, 0.68, CELL * 0.97);
  // Side faces are short rectangles: crop the photograph rather than squash it.
  for (let i = 0; i < hedgeBaseGeo.attributes.uv.count; i++) {
    if (Math.abs(hedgeBaseGeo.attributes.normal.getY(i)) < .5) {
      hedgeBaseGeo.attributes.uv.setY(i, hedgeBaseGeo.attributes.uv.getY(i) * .68 / (CELL * .97));
    }
  }
  // Share the same rounded lighting normal across duplicated corner vertices.
  // Keep UV seams, silhouette and collision dimensions unchanged.
  const hedgePositions = hedgeBaseGeo.attributes.position;
  const hedgeNormals = hedgeBaseGeo.attributes.normal;
  const hedgeNormal = new THREE.Vector3();
  for (let i = 0; i < hedgePositions.count; i++) {
    hedgeNormal.set(
      hedgePositions.getX(i) / (CELL * .97 / 2),
      hedgePositions.getY(i) / .34,
      hedgePositions.getZ(i) / (CELL * .97 / 2)
    ).normalize();
    hedgeNormals.setXYZ(i, hedgeNormal.x, hedgeNormal.y, hedgeNormal.z);
  }
  hedgeNormals.needsUpdate = true;
  // Phong supports the subtle normal-map relief without Standard's PBR model.
  const hedgeBaseMat = new THREE.MeshPhongMaterial({
    map: foliageTex,
    normalMap: foliageNormal, normalScale: new THREE.Vector2(.5, .5),
    shininess: 6, specular: 0x080808,
    color: 0xffffff,
  });

  // Сфера 6×4 = 36 треугольников против 80 у icosahedron(…, 1):
  // силуэт остаётся округлым, а вершин в 2.2 раза меньше.
  const foliageGeo = new THREE.SphereGeometry(0.62, 6, 4);
  // Longitude covers twice the distance of latitude; keep leaf proportions.
  for (let i = 0; i < foliageGeo.attributes.uv.count; i++) {
    foliageGeo.attributes.uv.setX(i, foliageGeo.attributes.uv.getX(i) * 2);
  }
  {
    const fp = foliageGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const vx = fp.getX(i);
      const vy = fp.getY(i);
      const vz = fp.getZ(i);
      // смещение зависит только от координат, поэтому общие вершины не расходятся
      const f =
        1 +
        Math.sin(vx * 9 + vy * 7 + vz * 11) * 0.07 +
        Math.sin(vx * 4.3 + vz * 5.7) * 0.04;
      fp.setXYZ(i, vx * f, vy * f, vz * f);
    }
    fp.needsUpdate = true;
    foliageGeo.computeVertexNormals();
  }
  const foliageMat = new THREE.MeshPhongMaterial({
    map: foliageTex,
    normalMap: foliageNormal, normalScale: new THREE.Vector2(.5, .5),
    shininess: 6, specular: 0x080808,
    color: 0xffffff,
  });

  const leafCardGeo = new THREE.PlaneGeometry(1, 1);
  const leafCardMat = new THREE.MeshLambertMaterial({
    map: leafClusterTex,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
  });

  const houseBodyGeo = new THREE.BoxGeometry(1.8, 1.0, 1.8);
  const houseSurface = window.MedievalHouses.create(THREE, renderer);
  const woodSurface = window.MedievalHouses.create(THREE, renderer, "wood_");
  const houseBodyMat = houseSurface.material;

  const houseRoofGeo = new THREE.ConeGeometry(1.33, 0.82, 4, 1).toNonIndexed();
  houseRoofGeo.rotateY(Math.PI / 4);
  houseRoofGeo.computeVertexNormals();
  const houseFlatRoofGeo = new THREE.BoxGeometry(1, 1, 1);
  const houseSpireGeo = new THREE.ConeGeometry(0.16, 0.7, 8);
  const houseGableRoofGeo = (() => {
    const A = [-0.5, 0, -0.5];
    const B = [0.5, 0, -0.5];
    const C = [-0.5, 0, 0.5];
    const D = [0.5, 0, 0.5];
    const E = [0, 1, -0.5];
    const F = [0, 1, 0.5];
    const verts = [A, B, C, D, E, F];
    const indices = [
      0, 2, 5, 0, 5, 4, // левый скат
      1, 5, 3, 1, 4, 5, // правый скат
    ];
    const g = new THREE.BufferGeometry();
    const positions = [];
    for (const idx of indices) positions.push(...verts[idx]);
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const uv = [];
    indices.forEach((idx) => {
      const [, y, z] = verts[idx];
      uv.push(z + 0.5, y);
    });
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  })();
  const houseGableEndGeo = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([
      -.5,0,-.5, 0,1,-.5, .5,0,-.5,
      -.5,0,.5, .5,0,.5, 0,1,.5,
    ], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0,0, .5,.5, 1,0, 0,0, 1,0, .5,.5], 2));
    g.computeVertexNormals();
    return g;
  })();
  const houseGableMat = new THREE.MeshStandardMaterial({
    name: "Stone gable walls",
    map: houseSurface.stoneMaps.color,
    normalMap: houseSurface.stoneMaps.normal,
    normalScale: new THREE.Vector2(1, 1), roughness: .95,
    side: THREE.DoubleSide,
  });
  houseSurface.configureStoneMaterial(houseGableMat);
  const houseRoofMat = new THREE.MeshStandardMaterial({
    name: "Roof tiles (separate from limestone walls)",
    map: houseSurface.roofMaps.color,
    normalMap: houseSurface.roofMaps.normal,
    normalScale: new THREE.Vector2(1, 1),
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  houseSurface.configureRoofMaterial(houseRoofMat);
  const woodRoofMat = houseRoofMat.clone();
  woodRoofMat.map = woodSurface.roofMaps.color;
  woodRoofMat.normalMap = woodSurface.roofMaps.normal;
  woodRoofMat.normalScale.set(1.8, 1.8);
  woodRoofMat.roughness = 1;
  woodSurface.configureRoofMaterial(woodRoofMat);
  const woodGableMat = houseGableMat.clone();
  woodGableMat.map = woodSurface.stoneMaps.color;
  woodGableMat.normalMap = woodSurface.stoneMaps.normal;
  woodSurface.configureStoneMaterial(woodGableMat);

  const houseChimneyGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
  const houseChimneyMat = new THREE.MeshStandardMaterial({
    color: 0x7a4a3a,
    roughness: 0.9,
    metalness: 0.02,
  });

  // ---------- Земля ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x04070c, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  // Blend the exterior terrain and river into the same boundary haze.
  // Distance is measured from the map, not the camera: no endless sharp canal.
  function applyMapEdgeHaze(shader) {
    shader.uniforms.mapEdgeHalfSize = {value: new THREE.Vector2(COLS*CELL/2, ROWS*CELL/2)};
    shader.vertexShader = 'varying vec2 mapEdgeWorldXZ;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nmapEdgeWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = 'varying vec2 mapEdgeWorldXZ;\nuniform vec2 mapEdgeHalfSize;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
      #include <fog_fragment>
      #ifdef USE_FOG
        vec2 beyondMap = max(abs(mapEdgeWorldXZ)-mapEdgeHalfSize, vec2(0.0));
        float edgeHaze = smoothstep(0.0, 12.0, max(beyondMap.x, beyondMap.y));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, edgeHaze);
      #endif
    `);
  }
  ground.material.onBeforeCompile = applyMapEdgeHaze;
  ground.material.customProgramCacheKey = () => 'ground-map-edge-haze-v1';
  scene.add(ground);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL),
    new THREE.MeshStandardMaterial({
      map: floorTexNight,
      normalMap: floorTexNight.userData.normalMap,
      dithering: true,
      normalScale: new THREE.Vector2(1, 1),
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.08,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const floorReliefCenter = new THREE.Vector2();
  const floorReliefRange = new THREE.Vector2(4, 8);
  floor.material.userData.reliefRange = floorReliefRange;
  floor.material.onBeforeCompile = shader => {
    shader.uniforms.floorReliefCenter = { value: floorReliefCenter };
    shader.uniforms.floorReliefRange = { value: floorReliefRange };
    shader.vertexShader = 'varying vec2 vFloorWorldXZ;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vFloorWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
    `);
    shader.fragmentShader = `
      varying vec2 vFloorWorldXZ;
      uniform vec2 floorReliefCenter;
      uniform vec2 floorReliefRange;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #ifdef USE_NORMALMAP_TANGENTSPACE
        vec2 floorDelta = vFloorWorldXZ - floorReliefCenter;
        float floorRelief = 1.0 - smoothstep(
          floorReliefRange.x * floorReliefRange.x,
          floorReliefRange.y * floorReliefRange.y, dot(floorDelta, floorDelta));
        if (floorRelief > 0.0) {
          vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          normal = normalize(mix(normal, normalize(tbn * mapN), floorRelief));
        }
      #endif
    `);
  };
  floor.material.customProgramCacheKey = () => 'floor-local-relief-v1';
  scene.add(floor);

  // ---------- Река, мостики, ямы ----------
  const waterTex = makeWaterTexture();
  const waterGeo = new THREE.PlaneGeometry(90, 6);
  const waterTime = { value: 0 }, waterDay = { value: 0 };
  const riverFlowPixels = new Uint8Array(COLS * ROWS * 4);
  const riverFlowMap = new THREE.DataTexture(riverFlowPixels, COLS, ROWS);
  riverFlowMap.magFilter = riverFlowMap.minFilter = THREE.LinearFilter;
  riverFlowMap.needsUpdate = true;
  // Static soft contact shade, rebuilt only when the river changes.
  const bankShadeSize = 512;
  const bankShadePixels = new Uint8Array(bankShadeSize * bankShadeSize * 4);
  const bankShadeMap = new THREE.DataTexture(bankShadePixels, bankShadeSize, bankShadeSize);
  bankShadeMap.magFilter = bankShadeMap.minFilter = THREE.LinearFilter;
  bankShadeMap.needsUpdate = true;
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, normalMap: waterTex, normalScale: new THREE.Vector2(.62,.62),
    roughness: .32, metalness: 0,
    // Opaque depth colour simulates the river bed without a refraction pass.
    transparent: false,
  });
  waterMat.onBeforeCompile = shader => {
    applyMapEdgeHaze(shader);
    shader.uniforms.waterTime = waterTime;
    shader.uniforms.waterDay = waterDay;
    shader.uniforms.riverFlowMap = {value: riverFlowMap};
    shader.uniforms.bankShadeMap = {value: bankShadeMap};
    shader.uniforms.riverWorldSize = {value: new THREE.Vector2(COLS*CELL,ROWS*CELL)};
    shader.vertexShader = 'varying vec2 waterUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nwaterUv = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = 'uniform sampler2D bankShadeMap;\nuniform sampler2D riverFlowMap;\nuniform vec2 riverWorldSize;\nuniform float waterTime;\nuniform float waterDay;\nvarying vec2 waterUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 waterTint = mix(vec3(.025,.14,.19),vec3(.035,.24,.29),waterDay);
      diffuseColor.rgb *= waterTint;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      vec2 bankContact = texture2D(bankShadeMap,waterUv/riverWorldSize+.5).rg;
      float shoreNormalBlend = smoothstep(0.0,.8,bankContact.g);
      vec2 rippleUv = waterUv * .14;
      vec2 flow = texture2D(riverFlowMap,waterUv/riverWorldSize+.5).rg*2.0-1.0;
      flow /= max(length(flow),.01);
      float phase = fract(waterTime*.045);
      float phaseB = fract(phase+.5);
      float blend = abs(phase-.5)*2.0;
      // Two staggered advection phases prevent stretched textures and resets.
      vec3 normalA = texture2D(normalMap,rippleUv-flow*phase*.8).xyz*2.0-1.0;
      vec3 normalB = texture2D(normalMap,rippleUv-flow*phaseB*.8).xyz*2.0-1.0;
      vec3 rippleA = mix(normalA,normalB,blend);
      vec3 rippleB = rippleA;
      // Calm the contact strip and gradually flatten its normals; wave
      // highlights must not cut across the water/soil transition.
      vec2 rippleSlope = (rippleA.xy+rippleB.xy*.55)*normalScale;
      rippleSlope *= mix(1.0,.08,shoreNormalBlend);
      vec3 mapN = normalize(vec3(rippleSlope,1.0));
      normal = normalize(tbn*mapN);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 eye = normalize(vViewPosition);
      float fresnel = (.03+.55*pow(1.0-clamp(dot(eye,normal),0.0,1.0),5.0)) * (1.0-.85*shoreNormalBlend);
      vec3 reflected = inverseTransformDirection(reflect(-eye,normal),viewMatrix);
      float skyHeight = smoothstep(-.08,.85,reflected.y);
      vec3 horizon = mix(vec3(.035,.10,.15),vec3(.30,.48,.57),waterDay);
      vec3 zenith = mix(vec3(.012,.042,.085),vec3(.08,.25,.38),waterDay);
      vec3 skyReflection = mix(horizon,zenith,skyHeight);
      outgoingLight = outgoingLight*(1.0-fresnel)+skyReflection*fresnel;
      // Soft illustrative fill keeps the river readable at night, with broad
      // pale accents instead of sharp realistic glitter. Fog still applies.
      float waveSlope = rippleA.x+rippleB.y*.45;
      float softCrest = smoothstep(.06,.23,waveSlope);
      float crestBreak = smoothstep(-.06,.12,rippleB.x-rippleA.y*.35);
      float trough = smoothstep(.03,.22,-waveSlope);
      vec3 paintedFill = mix(vec3(.012,.048,.075),vec3(.009,.025,.030),waterDay);
      vec3 crestTint = mix(vec3(.026,.052,.061),vec3(.045,.080,.082),waterDay);
      outgoingLight *= 1.0-.16*trough;
      outgoingLight += paintedFill + crestTint*softCrest*(.45+.55*crestBreak);
      // A broken, soft band of earthy shallows blends into the bank colour.
      // Reuse the existing mask fetch and water lighting, including at night.
      float contactBlend = smoothstep(0.0,.85,bankContact.g);
      float waterLuma = dot(outgoingLight,vec3(.2126,.7152,.0722));
      // Match the dark brown soil at the submerged bank, not the pale road.
      vec3 wetEarth = waterLuma * vec3(.24,.185,.13);
      outgoingLight = mix(outgoingLight,wetEarth,contactBlend);
      #include <opaque_fragment>
    `);
  };
  waterMat.customProgramCacheKey = () => 'river-channel-flow-v12-narrow-shore';

  const bridgeDeckGeo = new THREE.BoxGeometry(1.5, 0.12, 7.8);
  const bridgeDeckTexture = makeBridgeTexture();
  const bridgeDeckMat = new THREE.MeshStandardMaterial({
    map: bridgeDeckTexture,
    normalMap: bridgeDeckTexture.userData.normalMap,
    normalScale: new THREE.Vector2(1.5, 1.5),
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.02,
  });
  const bridgeAbutmentGeo = new THREE.BoxGeometry(1.7, .6, .7);
  const bridgeAbutmentMat = new THREE.MeshStandardMaterial({color:0x65503a,roughness:1});
  const bridgeEdgeGeo = new THREE.BoxGeometry(0.06, 0.06, 7.8);
  const bridgeEdgeMat = new THREE.MeshBasicMaterial({ color: 0xffc777, transparent: true, opacity: 0.75 });

  const pitDiskGeo = new THREE.CircleGeometry(PIT_RADIUS, 32);
  pitDiskGeo.rotateX(-Math.PI / 2);
  const pitRimGeo = new THREE.RingGeometry(PIT_RADIUS, PIT_RADIUS + 0.09, 32);
  pitRimGeo.rotateX(-Math.PI / 2);
  const pitDiskMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: true });
  const PIT_DEPTH = 2.8;
  const pitShaftGeo = new THREE.CylinderGeometry(PIT_RADIUS, PIT_RADIUS, PIT_DEPTH, 32, 12, true);
  pitShaftGeo.translate(0, -PIT_DEPTH / 2, 0);
  const pitShaftColors = [];
  const pitShaftPositions = pitShaftGeo.getAttribute("position");
  for (let i = 0; i < pitShaftPositions.count; i++) {
    const depth = -pitShaftPositions.getY(i);
    const brightness = Math.pow(Math.max(0, 1 - depth / PIT_DEPTH), 5) * .35;
    pitShaftColors.push(brightness, brightness, brightness);
  }
  pitShaftGeo.setAttribute("color", new THREE.Float32BufferAttribute(pitShaftColors, 3));
  const pitSoilCanvas = document.createElement("canvas");
  pitSoilCanvas.width = pitSoilCanvas.height = 128;
  const pitSoilContext = pitSoilCanvas.getContext("2d");
  pitSoilContext.fillStyle = "#493629";
  pitSoilContext.fillRect(0, 0, 128, 128);
  let soilSeed = 137;
  const soilRandom = () => ((soilSeed = (Math.imul(soilSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 1800; i++) {
    const shade = 30 + Math.floor(soilRandom() * 45);
    pitSoilContext.fillStyle = `rgba(${shade + 12},${shade},${Math.floor(shade * .72)},.35)`;
    const x=soilRandom()*128,y=soilRandom()*128,rx=.4+soilRandom()*3,ry=.4+soilRandom()*2;
    for(const dx of [-128,0,128])for(const dy of [-128,0,128]){
      if(x+dx+rx<0||x+dx-rx>128||y+dy+ry<0||y+dy-ry>128)continue;
      pitSoilContext.beginPath();
      pitSoilContext.ellipse(x+dx,y+dy,rx,ry,0,0,Math.PI*2);
      pitSoilContext.fill();
    }
  }
  const pitSoilMap = new THREE.CanvasTexture(pitSoilCanvas);
  pitSoilMap.colorSpace = THREE.SRGBColorSpace;
  const bankSoilMap = pitSoilMap.clone();
  bankSoilMap.wrapS = bankSoilMap.wrapT = THREE.RepeatWrapping;
  bankSoilMap.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  bankSoilMap.needsUpdate = true;
  const bankRoadTexture = { value: floorTexNight };
  // External lights reveal the earth; vertex colours retain depth occlusion.
  const pitShaftMat = new THREE.MeshStandardMaterial({
    map: pitSoilMap, color: 0xffffff, vertexColors: true, side: THREE.BackSide, fog: true,
    roughness: 1, metalness: 0, bumpMap: pitSoilMap, bumpScale: .025,
  });
  const pitRimMat = new THREE.MeshStandardMaterial({
    color: 0x595047, roughness: 1, metalness: 0,
    map: pitSoilMap,
    side: THREE.DoubleSide,
    fog: true,
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
  let pitShafts = null;

  // ---------- Шарик ----------
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 32, 24),
    new THREE.MeshStandardMaterial({
      map: makeBallTexture(ballColor, ballPattern),
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.15,
      emissive: shade(ballColor, -0.1),
      emissiveIntensity: 0.28,
    })
  );
  // тень мячика/героя рисует отдельная «пятно»-плоскость (см. heroShadow):
  // так карту теней можно печь один раз, а не пересчитывать каждый кадр
  ball.castShadow = false;
  ball.receiveShadow = true;
  scene.add(ball);

  const ballLight = new THREE.PointLight(shade(ballColor, 0.18), 16, 8, 2);
  ballLight.position.set(0, 0.7, 0);
  ball.add(ballLight);

  // Мягкое пятно-тень под героем: динамическую тень мячика/животного
  // печь в статичную карту нельзя (она бы «застыла» на старте).
  function makeHeroShadowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.62)");
    grad.addColorStop(0.45, "rgba(0,0,0,0.36)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const heroShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: makeHeroShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    })
  );
  heroShadow.rotation.x = -Math.PI / 2;
  heroShadow.position.y = 0.075;
  heroShadow.renderOrder = 2;
  scene.add(heroShadow);

  // ---------- Животные-герои ----------
  const animalFurTex = makeFurTexture();
  const animalGroups = {};

  function createAnimalCharacter(kind) {
    const p = ANIMAL_PALETTES[kind];
    const group = new THREE.Group();
    const isDog = kind === "dog";
    const isLion = kind === "lion";
    const isTiger = kind === "tiger";
    const isLeopard = kind === "leopard";
    const isCat = kind === "cat";

    const furMat = new THREE.MeshStandardMaterial({
      color: p.fur,
      map: animalFurTex,
      bumpMap: animalFurTex,
      bumpScale: 0.025,
      roughness: 0.92,
      metalness: 0,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: p.light,
      map: animalFurTex,
      bumpMap: animalFurTex,
      bumpScale: 0.018,
      roughness: 0.9,
      metalness: 0,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: p.dark, roughness: 0.88, metalness: 0 });
    const earMat = new THREE.MeshStandardMaterial({ color: p.ear, roughness: 0.92, metalness: 0 });
    const maneMat = new THREE.MeshStandardMaterial({ color: p.mane || p.dark, roughness: 0.95, metalness: 0 });

    const addMesh = (mesh, parent = group) => {
      // тень героя рисует пятно (heroShadow) — в статичную карту теней его не печём
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // тело и бёдра
    const body = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), furMat));
    body.scale.set(0.24, 0.25, 0.4);
    body.position.y = 0.46;

    for (const side of [-1, 1]) {
      const haunch = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), furMat));
      haunch.scale.set(0.15, 0.18, 0.21);
      haunch.position.set(side * 0.14, 0.35, 0.18);
    }

    const chest = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), lightMat));
    chest.scale.set(0.16, 0.18, 0.13);
    chest.position.set(0, 0.37, -0.25);

    const neck = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), furMat));
    neck.scale.set(0.15, 0.17, 0.16);
    neck.position.set(0, 0.58, -0.23);

    // голова
    const head = new THREE.Group();
    head.position.set(0, 0.67, -0.35);
    group.add(head);

    const headMesh = addMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), furMat),
      head
    );
    headMesh.scale.set(1, 0.95, 1);

    const snout = addMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), lightMat),
      head
    );
    snout.position.set(0, -0.055, -0.145);
    snout.scale.set(0.9, 0.72, 1.2);

    for (const side of [-1, 1]) {
      const eyeWhite = addMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.041, 10, 8), lightMat),
        head
      );
      eyeWhite.position.set(side * 0.072, 0.04, -0.16);
      eyeWhite.scale.z = 0.62;

      const iris = addMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), new THREE.MeshStandardMaterial({
          color: p.eye,
          roughness: 0.3,
          metalness: 0.05,
        })),
        head
      );
      iris.position.set(side * 0.074, 0.04, -0.185);

      const pupil = addMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), darkMat),
        head
      );
      pupil.position.set(side * 0.075, 0.04, -0.202);
    }

    const nose = addMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({
        color: p.nose,
        roughness: 0.5,
      })),
      head
    );
    nose.position.set(0, -0.08, -0.245);
    nose.scale.set(1.25, 0.8, 1);

    const mouth = addMesh(
      new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.008, 0.012), darkMat),
      head
    );
    mouth.position.set(0, -0.12, -0.245);

    // уши / грива
    if (isDog) {
      for (const side of [-1, 1]) {
        const ear = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), earMat), head);
        ear.position.set(side * 0.165, -0.005, -0.02);
        ear.scale.set(0.52, 1.35, 0.8);
        ear.rotation.z = side * 0.28;
      }
      const patch = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), earMat), head);
      patch.position.set(-0.065, 0.09, -0.14);
      patch.scale.set(0.85, 0.85, 0.32);
    } else if (isLion) {
      const mane = addMesh(
        new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.085, 8, 20), maneMat),
        head
      );
      mane.position.z = -0.045;
      for (const side of [-1, 1]) {
        const ear = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 6), earMat), head);
        ear.position.set(side * 0.115, 0.155, -0.025);
      }
      const chinTuft = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 6), maneMat), head);
      chinTuft.position.set(0, -0.19, -0.09);
      chinTuft.rotation.x = Math.PI;
    } else {
      for (const side of [-1, 1]) {
        const ear = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 4), earMat), head);
        ear.position.set(side * 0.1, 0.17, -0.01);
        ear.rotation.z = side * 0.18;
        const inner = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.043, 0.1, 4), lightMat), head);
        inner.position.set(side * 0.098, 0.16, -0.035);
        inner.rotation.z = side * 0.18;
      }
    }

    // усы
    if (!isDog) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const whisker = addMesh(
            new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0015, 0.17, 3), lightMat),
            head
          );
          whisker.rotation.z = Math.PI / 2 + side * 0.12 * (i - 1);
          whisker.rotation.y = side * 0.12;
          whisker.position.set(side * (0.13 + i * 0.005), -0.075 + i * 0.015, -0.17);
        }
      }
    }

    // лапы
    const legs = [];
    const legOffsets = [0, Math.PI, Math.PI, 0];
    const legPositions = [
      [-0.13, -0.18],
      [0.13, -0.18],
      [-0.13, 0.19],
      [0.13, 0.19],
    ];
    legPositions.forEach(([lx, lz], index) => {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.39, lz);
      const thigh = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), furMat), leg);
      thigh.scale.set(0.075, 0.12, 0.1);
      const shin = addMesh(
        new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.034, 0.33, 7), furMat),
        leg
      );
      shin.position.y = -0.165;
      const paw = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), earMat), leg);
      paw.position.set(0, -0.335, -0.02);
      paw.scale.set(1, 0.68, 1.3);
      group.add(leg);
      legs.push({ group: leg, offset: legOffsets[index] });
    });

    // хвост из изогнутой трубки
    const tail = new THREE.Group();
    tail.position.set(0, 0.55, 0.33);
    group.add(tail);

    const tailPoints = isDog
      ? [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.02, 0.1), new THREE.Vector3(0, 0.08, 0.17)]
      : isLion
        ? [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.08, 0.13), new THREE.Vector3(0, 0.25, 0.19), new THREE.Vector3(0, 0.37, 0.1)]
        : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.1, 0.14), new THREE.Vector3(0, 0.3, 0.2), new THREE.Vector3(0, 0.46, 0.08)];
    const tailCurve = new THREE.CatmullRomCurve3(tailPoints);
    const tailMesh = addMesh(
      new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 10, isDog ? 0.032 : 0.035, 6, false), furMat),
      tail
    );
    if (isLion) {
      const end = tailCurve.getPoint(1);
      const tuft = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), maneMat), tail);
      tuft.position.copy(end);
    }

    // полоски и пятна
    if (isTiger || isCat) {
      const stripeMat = new THREE.MeshStandardMaterial({ color: p.dark, roughness: 0.9 });
      const count = isTiger ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const z = -0.26 + (i * 0.52) / (count - 1);
        const shrink = Math.sqrt(Math.max(0.08, 1 - (z / 0.4) ** 2));
        const ring = addMesh(
          new THREE.Mesh(
            new THREE.TorusGeometry(0.246, isTiger ? 0.022 : 0.012, 6, 18),
            stripeMat
          )
        );
        ring.position.set(0, 0.46, z);
        ring.scale.set(shrink, shrink, 1);
      }

      if (isTiger) {
        for (const side of [-1, 1]) {
          for (let i = 0; i < 2; i++) {
            const stripe = addMesh(
              new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.045), stripeMat),
              head
            );
            stripe.position.set(side * (0.1 + i * 0.05), -0.01 + i * 0.03, -0.14);
          }
        }
        for (let i = 0; i < 3; i++) {
          const stripe = addMesh(
            new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.02), stripeMat),
            head
          );
          stripe.position.set(-0.045 + i * 0.045, 0.12, -0.18);
        }
      }
    } else if (isLeopard) {
      const spotMat = new THREE.MeshStandardMaterial({ color: p.dark, roughness: 0.9 });
      const rnd = makeRandom(431);
      for (let i = 0; i < 22; i++) {
        const z = -0.33 + rnd() * 0.66;
        const shrink = Math.sqrt(Math.max(0.1, 1 - (z / 0.42) ** 2));
        const side = i % 2 === 0 ? -1 : 1;
        const angle = rnd() * Math.PI;
        const spot = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), spotMat));
        spot.position.set(
          side * Math.cos(angle) * 0.236 * shrink,
          0.46 + Math.sin(angle) * 0.245 * shrink,
          z
        );
        spot.scale.set(0.9, 0.8, 0.35);
        spot.rotation.z = angle;
      }
      for (const side of [-1, 1]) {
        const spot = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), spotMat), head);
        spot.position.set(side * 0.12, 0.08, -0.14);
        spot.scale.set(0.9, 0.8, 0.35);
      }
    } else if (isDog) {
      const saddle = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), earMat));
      saddle.scale.set(0.18, 0.045, 0.28);
      saddle.position.set(0, 0.69, 0.05);
    }

    group.visible = false;
    group.scale.setScalar(isLion ? 1.08 : isCat ? 0.96 : 1.0);
    group.userData = { kind, legs, tail, head, phase: 0 };
    scene.add(group);
    animalGroups[kind] = group;
    return group;
  }

  for (const kind of ["cat", "dog", "lion", "tiger", "leopard"]) {
    createAnimalCharacter(kind);
  }

  // ---------- Пять главных ориентиров ----------
  const landmarkGroups = {};
  const landmarkBeacons = [];
  let windmillBlades = null;

  function addLandmarkMesh(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createLandmarks() {
    // Landmarks retain their original closed roof independently of house textures.
    const landmarkGableRoofGeo = (() => {
      const A = [-0.5, 0, -0.5];
      const B = [0.5, 0, -0.5];
      const C = [-0.5, 0, 0.5];
      const D = [0.5, 0, 0.5];
      const E = [0, 1, -0.5];
      const F = [0, 1, 0.5];
      const verts = [A, B, C, D, E, F];
      const indices = [
        0, 2, 5, 0, 5, 4, // левый скат
        1, 5, 3, 1, 4, 5, // правый скат
        0, 4, 1, // передний фронтон
        2, 3, 5, // задний фронтон
      ];
      const g = new THREE.BufferGeometry();
      const positions = [];
      for (const idx of indices) positions.push(...verts[idx]);
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.computeVertexNormals();
      return g;
    })();
    const beaconTex = makeStarTexture();
    const stone = new THREE.MeshStandardMaterial({ color: 0xe3d7c0, roughness: 0.9 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 0.95 });
    const marble = new THREE.MeshStandardMaterial({ color: 0xf2ebdc, roughness: 0.75 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6f4d31, roughness: 0.86 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4d3422, roughness: 0.9 });
    const roofRed = new THREE.MeshStandardMaterial({ color: 0x9f4d32, roughness: 0.82 });
    const roofGreen = new THREE.MeshStandardMaterial({ color: 0x466256, roughness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9ad45, roughness: 0.35, metalness: 0.55 });
    const darkOpening = new THREE.MeshBasicMaterial({ color: 0x2c241c });
    const warmWindow = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const cityGlass = new THREE.MeshStandardMaterial({
      color: 0x5a91b5,
      roughness: 0.16,
      metalness: 0.52,
      emissive: 0x0a2638,
      emissiveIntensity: 0.55,
    });
    const cityGlass2 = new THREE.MeshStandardMaterial({
      color: 0x76a9c6,
      roughness: 0.14,
      metalness: 0.5,
      emissive: 0x0a2434,
      emissiveIntensity: 0.5,
    });
    const cityBand = new THREE.MeshBasicMaterial({
      color: 0xc6f1ff,
      transparent: true,
      opacity: 0.72,
    });
    const redLight = new THREE.MeshBasicMaterial({ color: 0xff5544 });

    const addBeacon = (group, color, y, scale = 1.5) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: beaconTex,
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        })
      );
      sprite.position.set(0, y, 0);
      sprite.scale.set(scale, scale, 1);
      group.add(sprite);
      landmarkBeacons.push({ sprite, baseScale: scale, phase: Math.random() * Math.PI * 2 });
    };

    const addCross = (group, x, y, z, scale = 1) => {
      addLandmarkMesh(group, new THREE.BoxGeometry(0.06, 0.55, 0.06), gold, x, y, z, scale, scale, scale);
      addLandmarkMesh(group, new THREE.BoxGeometry(0.3, 0.055, 0.06), gold, x, y + 0.1, z, scale, scale, scale);
    };

    // 1. Мельница
    {
      const g = new THREE.Group();
      addLandmarkMesh(g, new THREE.CylinderGeometry(0.55, 0.82, 3.3, 8), stone, 0, 1.65, 0);
      addLandmarkMesh(g, new THREE.ConeGeometry(0.72, 0.85, 8), woodDark, 0, 3.72, 0);
      // Each opening rests on an actual octagonal face, including the taper.
      const attachOpening = (angle, y, width, height, depth, material, grounded = false) => {
        const taper = (0.82 - 0.55) / 3.3;
        const faceCos = Math.cos(Math.PI / 8);
        const normal = new THREE.Vector3(Math.sin(angle), taper * faceCos, Math.cos(angle)).normalize();
        const right = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
        const up = new THREE.Vector3().crossVectors(normal, right);
        const offset = depth / 2 - 0.003;
        if (grounded) y = height / 2 * up.y - offset * normal.y;
        const radius = (0.82 - taper * y) * faceCos;
        const panel = addLandmarkMesh(g, new THREE.BoxGeometry(width, height, depth), material,
          radius * Math.sin(angle), y, radius * Math.cos(angle));
        panel.position.addScaledVector(normal, offset);
        panel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
      };
      attachOpening(Math.PI + Math.PI / 8, 0.3, 0.34, 0.6, 0.08, wood, true);
      for (const side of [-1, 1]) {
        attachOpening(Math.PI + side * Math.PI / 8, 1.75, 0.24, 0.3, 0.06, warmWindow);
      }
      const blades = new THREE.Group();
      blades.position.set(0, 2.85, -0.8);
      for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.z = i * Math.PI / 2;
        addLandmarkMesh(pivot, new THREE.BoxGeometry(0.18, 1.55, 0.07), wood, 0, 0.78, 0);
        addLandmarkMesh(pivot, new THREE.BoxGeometry(0.32, 0.9, 0.04), woodDark, 0, 0.72, 0.045);
        blades.add(pivot);
      }
      addLandmarkMesh(blades, new THREE.CylinderGeometry(0.12, 0.12, 0.16, 8), woodDark, 0, 0, 0, 1, 1, 1, Math.PI / 2);
      g.add(blades);
      windmillBlades = blades;
      addBeacon(g, 0xffca6a, 4.45, 1.7);
      g.visible = false;
      scene.add(g);
      landmarkGroups.windmill = g;
    }

    // 2. Колокольня
    {
      const g = new THREE.Group();
      addLandmarkMesh(g, new THREE.BoxGeometry(1.25, 3.7, 1.25), stone, 0, 1.85, 0);
      addLandmarkMesh(g, new THREE.BoxGeometry(1.4, 0.18, 1.4), stoneDark, 0, 3.76, 0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addLandmarkMesh(g, new THREE.CylinderGeometry(0.075, 0.075, 0.9, 8), marble, sx * 0.45, 4.25, sz * 0.45);
        }
      }
      for (const side of [-1, 1]) {
        addLandmarkMesh(g, new THREE.BoxGeometry(0.62, 0.7, 0.05), darkOpening, 0, 4.2, side * 0.64);
        addLandmarkMesh(g, new THREE.BoxGeometry(0.05, 0.7, 0.62), darkOpening, side * 0.64, 4.2, 0);
      }
      addLandmarkMesh(g, new THREE.BoxGeometry(1.32, 0.16, 1.32), stoneDark, 0, 4.76, 0);
      addLandmarkMesh(g, new THREE.ConeGeometry(0.88, 0.78, 4), roofGreen, 0, 5.23, 0, 1, 1, 1, 0, Math.PI / 4);
      addLandmarkMesh(g, new THREE.SphereGeometry(0.31, 12, 8), gold, 0, 5.8, 0, 1, 1.2, 1);
      addLandmarkMesh(g, new THREE.CylinderGeometry(0.035, 0.025, 0.5, 6), gold, 0, 6.16, 0);
      addCross(g, 0, 6.5, 0, 1.1);
      addLandmarkMesh(g, new THREE.BoxGeometry(0.34, 0.6, 0.06), wood, 0, 0.3, -0.64);
      addBeacon(g, 0xffdd8a, 6.85, 1.5);
      g.visible = false;
      scene.add(g);
      landmarkGroups.bell = g;
    }

    // 3. Церковь
    {
      const g = new THREE.Group();
      addLandmarkMesh(g, new THREE.BoxGeometry(1.65, 1.05, 1.15), stone, 0, 0.525, 0.2);
      addLandmarkMesh(g, landmarkGableRoofGeo, roofGreen, 0, 1.05, 0.2, 1.8, 0.62, 1.3);
      addLandmarkMesh(g, new THREE.BoxGeometry(0.7, 3.25, 0.7), stone, -0.48, 1.625, -0.32);
      addLandmarkMesh(g, new THREE.ConeGeometry(0.56, 0.68, 4), roofGreen, -0.48, 3.58, -0.32, 1, 1, 1, 0, Math.PI / 4);
      addLandmarkMesh(g, new THREE.SphereGeometry(0.26, 12, 8), gold, -0.48, 4.0, -0.32, 1, 1.2, 1);
      addLandmarkMesh(g, new THREE.CylinderGeometry(0.03, 0.02, 0.45, 6), gold, -0.48, 4.35, -0.32);
      addCross(g, -0.48, 4.68, -0.32, 0.9);
      for (const side of [-1, 1]) {
        addLandmarkMesh(g, new THREE.BoxGeometry(0.32, 0.4, 0.04), darkOpening, side * 0.35, 0.48, -0.38);
        addLandmarkMesh(g, new THREE.BoxGeometry(0.24, 0.32, 0.04), warmWindow, side * 0.3, 0.52, 0.78);
      }
      addLandmarkMesh(g, new THREE.BoxGeometry(0.3, 0.56, 0.06), wood, 0.3, 0.28, -0.38);
      addBeacon(g, 0xffe0a0, 4.95, 1.5);
      g.visible = false;
      scene.add(g);
      landmarkGroups.church = g;
    }

    // 4. Храм
    {
      const g = new THREE.Group();
      addLandmarkMesh(g, new THREE.BoxGeometry(1.9, 0.18, 1.9), marble, 0, 0.09, 0);
      addLandmarkMesh(g, new THREE.BoxGeometry(1.66, 0.12, 1.66), stoneDark, 0, 0.24, 0);
      const columns = [
        [-0.65, -0.55], [0, -0.55], [0.65, -0.55],
        [-0.65, 0.55], [0, 0.55], [0.65, 0.55],
      ];
      for (const [cx, cz] of columns) {
        addLandmarkMesh(g, new THREE.CylinderGeometry(0.085, 0.1, 2.15, 10), marble, cx, 1.35, cz);
      }
      addLandmarkMesh(g, new THREE.BoxGeometry(1.78, 0.27, 1.55), marble, 0, 2.55, 0);
      addLandmarkMesh(g, landmarkGableRoofGeo, roofRed, 0, 2.68, 0, 1.86, 0.55, 1.62);
      addLandmarkMesh(g, new THREE.CylinderGeometry(0.47, 0.5, 0.4, 12), marble, 0, 3.22, 0);
      addLandmarkMesh(g, new THREE.SphereGeometry(0.52, 14, 10), gold, 0, 3.65, 0, 1, 0.85, 1);
      addLandmarkMesh(g, new THREE.CylinderGeometry(0.045, 0.03, 0.65, 6), gold, 0, 4.15, 0);
      addLandmarkMesh(g, new THREE.SphereGeometry(0.1, 8, 6), gold, 0, 4.52, 0);
      addBeacon(g, 0xffd872, 4.75, 1.5);
      g.visible = false;
      scene.add(g);
      landmarkGroups.temple = g;
    }

    // 5. Москва Сити
    {
      const g = new THREE.Group();
      const towers = [
        { x: -0.35, z: -0.2, w: 0.62, h: 4.6, topH: 0.8, topW: 0.45, ant: 1.0, mat: cityGlass },
        { x: 0.42, z: 0.3, w: 0.5, h: 3.55, topH: 0.5, topW: 0.36, ant: 0.7, mat: cityGlass2 },
        { x: 0.32, z: -0.44, w: 0.42, h: 2.6, topH: 0.36, topW: 0.3, ant: 0.45, mat: cityGlass },
      ];
      for (const t of towers) {
        addLandmarkMesh(g, new THREE.BoxGeometry(t.w, t.h, t.w), t.mat, t.x, t.h / 2, t.z);
        addLandmarkMesh(g, new THREE.BoxGeometry(t.topW, t.topH, t.topW), t.mat, t.x, t.h + t.topH / 2, t.z);
        addLandmarkMesh(g, new THREE.CylinderGeometry(0.025, 0.018, t.ant, 6), marble, t.x, t.h + t.topH + t.ant / 2, t.z);
        for (let row = 1; row <= 5; row++) {
          const yy = (t.h * row) / 6;
          addLandmarkMesh(g, new THREE.BoxGeometry(t.w + 0.012, 0.035, t.w + 0.012), cityBand, t.x, yy, t.z);
        }
        const red = addLandmarkMesh(g, new THREE.SphereGeometry(0.06, 6, 4), redLight, t.x, t.h + t.topH + t.ant, t.z);
        red.castShadow = false;
      }
      addBeacon(g, 0x8fe8ff, 6.65, 1.7);
      g.visible = false;
      scene.add(g);
      landmarkGroups.city = g;
    }
  }

  createLandmarks();

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
    group.add(crystal, ring);
    group.visible = false;
    scene.add(group);
    keyItems.push({ group, crystal, ring, collected: false, cell: null });
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
    color: 0xffa92e,
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
  const previewOrbit = {
    theta: -0.82,
    phi: 0.95,
    radius: 128,
    dragging: false,
    lastX: 0,
    lastY: 0,
  };
  let jumpRequested = false;
  let boost = 1;
  let boosting = false;
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

  let sceneryGroup = null;
  const fogCullMeshes = [];
  const riverCullMeshes = [];
  const fogCullDirection = new THREE.Vector3();
  const fogCullFrustum = new THREE.Frustum();
  const fogCullProjection = new THREE.Matrix4();
  const fogCullInstances = new WeakMap();
  // FogExp2 никогда математически не достигает 100%. Оставляем не более
  // 0.1% исходного цвета, прежде чем убирать низкую статичную декорацию.
  const FOG_CULL_RESIDUAL = 0.001;
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
      if (river && river.waterCells.has(cellKey(x, y)) && !river.bridgeCells.has(cellKey(x, y))) return false;
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

  const LANDMARK_TARGETS = [
    { kind: "windmill", x: 8, y: 9 },
    { kind: "bell", x: 38, y: 9 },
    { kind: "church", x: 8, y: 41 },
    { kind: "temple", x: 38, y: 42 },
    { kind: "city", x: 40, y: 23 },
  ];

  function chooseLandmarkCells(grid) {
    const chosen = [];
    const used = [];

    for (const target of LANDMARK_TARGETS) {
      const candidates = [];
      for (let y = 1; y < ROWS - 1; y++) {
        for (let x = 1; x < COLS - 1; x++) {
          if (grid[y][x] !== 1) continue;
          if (used.some((u) => gridDistance(u, { x, y }) < 7)) continue;

          const hasOpen =
            grid[y][x - 1] === 0 ||
            grid[y][x + 1] === 0 ||
            grid[y - 1][x] === 0 ||
            grid[y + 1][x] === 0;
          if (!hasOpen) continue;

          const d = (x - target.x) ** 2 + (y - target.y) ** 2;
          candidates.push({ x, y, d });
        }
      }

      candidates.sort((a, b) => a.d - b.d);
      const pick = candidates[0];
      if (!pick) continue;

      const cell = { kind: target.kind, x: pick.x, y: pick.y, world: cellToWorld(pick.x, pick.y) };
      chosen.push(cell);
      used.push(cell);
    }

    return chosen;
  }

  function landmarkFacingYaw(grid, x, y) {
    if (grid[y - 1]?.[x] === 0) return 0;
    if (grid[y + 1]?.[x] === 0) return Math.PI;
    if (grid[y]?.[x + 1] === 0) return -Math.PI / 2;
    if (grid[y]?.[x - 1] === 0) return Math.PI / 2;
    return 0;
  }

  function placeLandmarks(cells) {
    for (const key of Object.keys(landmarkGroups)) {
      landmarkGroups[key].visible = false;
    }

    for (const cell of cells) {
      const group = landmarkGroups[cell.kind];
      if (!group) continue;
      group.position.set(cell.world.x, 0, cell.world.z);
      group.rotation.y = landmarkFacingYaw(maze.grid, cell.x, cell.y);
      group.visible = true;
    }
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
    const maxBridges = 3;

    if (candidates.length <= maxBridges) {
      for (const x of candidates) picks.add(x);
    } else {
      for (let i = 0; i < maxBridges; i++) {
        const idx = Math.round((i * (candidates.length - 1)) / (maxBridges - 1));
        picks.add(candidates[idx]);
      }
    }

    const waterCells = new Set();
    // A bend redirects the entire three-cell-wide channel.
    const bent = Math.random() < 0.5;
    const twoBends = bent && Math.random() < 0.5;
    const turnX = Math.floor(COLS * (0.55 + Math.random() * 0.15));
    // Leave a long straight reach between the two elbows (14?18 cells).
    const secondCenter = RIVER_ROWS[1] - (14 + Math.floor(Math.random() * 5));
    const endRow = twoBends ? secondCenter + 1 : ROWS - 1;
    const addRect = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) waterCells.add(cellKey(x, y));
      }
    };
    addRect(0, RIVER_ROWS[0], bent ? turnX + 1 : COLS - 1,
      RIVER_ROWS[RIVER_ROWS.length - 1]);
    if (bent) {
      addRect(turnX - 1, twoBends ? secondCenter - 1 : RIVER_ROWS[0],
        turnX + 1, twoBends ? RIVER_ROWS[RIVER_ROWS.length - 1] : endRow);
      if (twoBends) addRect(turnX - 1, endRow - 2, COLS - 1, endRow);
      // Crossings remain on the initial straight reach, clear of the elbow.
      for (const x of picks) if (x >= turnX - 2) picks.delete(x);
      if (!picks.size) {
        const x = 3;
        picks.add(x);
        grid[northRow][x] = grid[southRow][x] = 0;
      }
    }
    const free = x => x > 2 && x < (bent ? turnX - 3 : COLS - 3) &&
      [...picks].every(b => Math.abs(b - x) > 2);
    const slots = [];
    for (let x = 3; x < COLS - 4; x++) {
      if (free(x) && free(x + 1)) slots.push(x);
    }
    shuffleList(slots);
    const take = () => slots.pop();
    const tributarySlots = [];
    for (let x = 4; x < (bent ? turnX - 4 : COLS - 4); x++) {
      if (![...picks].some(b => (b >= x - 1 && b <= x + 2))) tributarySlots.push(x);
    }
    shuffleList(tributarySlots);
    const tributaryRoll = Math.random();
    const tributaryCount = tributaryRoll < 0.15 ? 0 : tributaryRoll < 0.55 ? 1 : 2;
    const tributaries = [];
    const tributaryBends = new Map();
    for (const x of tributarySlots) {
      if (tributaries.length >= tributaryCount) break;
      if (tributaries.some(other => Math.abs(other - x) < 7)) continue;
      tributaries.push(x);
      // On two-bend maps branch south, clear of the returning channel.
      const y0 = twoBends ? southRow : 0;
      const y1 = twoBends ? ROWS - 1 : northRow;
      // A long northbound reach may turn toward a side of the map.
      let bend = null;
      if (!twoBends && Math.random() < 0.45) {
        const row = 12 + Math.floor(Math.random() * 7);
        const left = x < COLS / 2;
        const startX = left ? 0 : x;
        const endX = left ? x + 1 : COLS - 1;
        let clear = true;
        for (let yy = row - 1; yy <= row + 2; yy++) {
          for (let xx = startX; xx <= endX; xx++) {
            if (waterCells.has(cellKey(xx, yy))) clear = false;
          }
        }
        if (clear && endX - startX >= 9) bend = { row, startX, endX };
      }
      for (let y = bend ? bend.row : y0; y <= y1; y++) {
        waterCells.add(cellKey(x, y));
        waterCells.add(cellKey(x + 1, y));
      }
      if (bend) {
        addRect(bend.startX, bend.row, bend.endX, bend.row + 1);
        tributaryBends.set(x, bend);
      }
    }
    if (slots.length && Math.random() < 0.25) {
      const x = take();
      waterCells.delete(cellKey(x, RIVER_ROWS[1]));
    }
    for (const key of waterCells) {
      const [x, y] = key.split(',').map(Number);
      grid[y][x] = 0;
    }

    const bridgeColumns = new Set(picks);
    const bridges = [...picks].sort((a, b) => a - b).map((cellX) => ({
      cellX,
      x: cellToWorld(cellX, 0).x,
    }));

    const zMin = cellToWorld(0, RIVER_ROWS[0]).z - CELL / 2;
    const zMax = cellToWorld(0, RIVER_ROWS[RIVER_ROWS.length - 1]).z + CELL / 2;

    const bridgeCells = new Set();
    for (const bridge of bridges) {
      bridge.z = (zMin + zMax) / 2;
      bridge.length = zMax - zMin;
      bridge.horizontal = false;
      for (const y of RIVER_ROWS) bridgeCells.add(cellKey(bridge.cellX, y));
    }
    for (const x of tributaries) {
      const bend = tributaryBends.get(x);
      const y0 = twoBends ? southRow + 2 : bend ? bend.row + 3 : 3;
      const y1 = twoBends ? ROWS - 4 : northRow - 2;
      const rows = [];
      for (let y = y0; y <= y1; y++) {
        if (grid[y][x - 1] === 0 && grid[y][x + 2] === 0) rows.push(y);
      }
      if (!rows.length) rows.push(Math.floor((y0 + y1) / 2));
      // Keep one crossing near the middle of each tributary.
      const middle = (y0 + y1) / 2;
      rows.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
      for (const y of rows.slice(0, 1)) {
        grid[y][x - 1] = grid[y][x + 2] = 0;
        bridgeCells.add(cellKey(x, y));
        bridgeCells.add(cellKey(x + 1, y));
        bridges.push({ x: cellToWorld(x, y).x + CELL / 2,
          z: cellToWorld(x, y).z, length: CELL * 2, horizontal: true });
      }
    }

    const bridgeGapHalf = 0.95;
    const fenceSegments = buildRiverFenceSegments(waterCells,bridgeCells,bridges);

    return {
      zMin,
      zMax,
      waterCells,
      outlet: bent && !twoBends ? "south" : "east",
      outletRow: twoBends ? secondCenter : RIVER_ROWS[1],
      bridgeColumns,
      bridgeCells,
      bridges,
      bridgeGapHalf,
      fenceSegments,
    };
  }

  function buildRiverFenceSegments(waterCells,bridgeCells,bridges) {
    const fenceSegments = [];

    for (const key of waterCells) {
      const [x, y] = key.split(',').map(Number);
      const w = cellToWorld(x, y);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        // The channel exits the map without a transverse fence at its mouth.
        if (x + dx < 0 || x + dx >= COLS || y + dy < 0 || y + dy >= ROWS) continue;
        if (waterCells.has(cellKey(x + dx, y + dy))) continue;
        if (bridgeCells.has(key) && bridges.some(b =>
          b.horizontal ? dx && Math.abs(w.z - b.z) < 0.01
            : dy && Math.abs(w.x - b.x) < 0.01)) continue;
        fenceSegments.push(dx
          ? { x1: w.x + dx * CELL / 2, x2: w.x + dx * CELL / 2,
              z: w.z - CELL / 2, z2: w.z + CELL / 2 }
          : { x1: w.x - CELL / 2, x2: w.x + CELL / 2,
              z: w.z + dy * CELL / 2, z2: w.z + dy * CELL / 2 });
      }
    }
    return fenceSegments;
  }

  function connectMapLayout(grid,river) {
    const wet=(x,y)=>river&&river.waterCells.has(cellKey(x,y));
    const inside=(x,y)=>x>0&&y>0&&x<COLS-1&&y<ROWS-1;
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    if(river){
      // A later tributary can widen an earlier crossing. Fit every bridge to
      // the final channel, and discard spans without two real landings.
      river.bridgeCells.clear();
      river.bridges=river.bridges.filter(bridge=>{
        const cx=Math.round(bridge.x/CELL+(COLS-1)/2),cy=Math.round(bridge.z/CELL+(ROWS-1)/2);
        const dx=bridge.horizontal?1:0,dy=bridge.horizontal?0:1;
        let ax=cx,ay=cy,bx=cx,by=cy;
        if(!wet(cx,cy))return false;
        while(inside(ax-dx,ay-dy)&&wet(ax-dx,ay-dy)){ax-=dx;ay-=dy;}
        while(inside(bx+dx,by+dy)&&wet(bx+dx,by+dy)){bx+=dx;by+=dy;}
        if(!inside(ax-dx,ay-dy)||!inside(bx+dx,by+dy))return false;
        grid[ay-dy][ax-dx]=0;grid[by+dy][bx+dx]=0;
        const length=Math.abs(bx-ax)+Math.abs(by-ay)+1;
        for(let i=0;i<length;i++)river.bridgeCells.add(cellKey(ax+dx*i,ay+dy*i));
        const a=cellToWorld(ax,ay),b=cellToWorld(bx,by);
        bridge.x=(a.x+b.x)/2;bridge.z=(a.z+b.z)/2;bridge.length=length*CELL;
        return true;
      });
    }
    for(let attempt=0;attempt<COLS*ROWS;attempt++) {
      const passable=makePassable(grid,river);
      const reached=bfsDistancesFrom(START_CELL.x,START_CELL.y,passable);
      let missing=false;
      for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(passable(x,y)&&reached[y][x]<0)missing=true;
      if(!missing){
        if(river){
          river.landingCells=new Set();
          for(const bridge of river.bridges)for(const side of [-1,1]){
            const along=side*(bridge.length/2+CELL/2);
            const x=Math.round((bridge.x+(bridge.horizontal?along:0))/CELL+(COLS-1)/2);
            const y=Math.round((bridge.z+(bridge.horizontal?0:along))/CELL+(ROWS-1)/2);
            if(!inside(x,y)||wet(x,y)||grid[y][x]!==0)throw new Error('Bridge lacks a dry road landing');
            river.landingCells.add(cellKey(x,y));
          }
          river.fenceSegments=buildRiverFenceSegments(river.waterCells,river.bridgeCells,river.bridges);
        }
        return;
      }
      // Grow from the entire connected component through dry walls only.
      // The first disconnected passage found needs the shortest new connector.
      const previous=new Int32Array(COLS*ROWS).fill(-2),queue=[];
      for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(reached[y][x]>=0){const id=y*COLS+x;previous[id]=-1;queue.push(id);}
      let target=-1;
      for(let head=0;head<queue.length&&target<0;head++) {
        const id=queue[head],x=id%COLS,y=Math.floor(id/COLS);
        for(const [dx,dy] of dirs){const nx=x+dx,ny=y+dy,nid=ny*COLS+nx;
          if(!inside(nx,ny)||previous[nid]!==-2||wet(nx,ny))continue;
          previous[nid]=id;queue.push(nid);
          if(passable(nx,ny)&&reached[ny][nx]<0){target=nid;break;}
        }
      }
      if(target>=0){for(let id=target;id>=0;id=previous[id])grid[Math.floor(id/COLS)][id%COLS]=0;continue;}
      // Different banks need a crossing. Choose the shortest straight span
      // from reachable dry terrain into a different land component.
      let crossing=null;
      for(const id of queue){const x=id%COLS,y=Math.floor(id/COLS);if(wet(x,y))continue;
        for(const [dx,dy] of dirs){let nx=x+dx,ny=y+dy;const cells=[];
          while(inside(nx,ny)&&wet(nx,ny)){cells.push({x:nx,y:ny});nx+=dx;ny+=dy;}
          if(!cells.length||!inside(nx,ny)||previous[ny*COLS+nx]!==-2)continue;
          if(!crossing||cells.length<crossing.cells.length)crossing={id,x,y,nx,ny,dx,dy,cells};
        }
      }
      if(!crossing)throw new Error('Cannot connect every traversable map area');
      for(let id=crossing.id;id>=0;id=previous[id])grid[Math.floor(id/COLS)][id%COLS]=0;
      grid[crossing.ny][crossing.nx]=0;
      for(const cell of crossing.cells){grid[cell.y][cell.x]=0;river.bridgeCells.add(cellKey(cell.x,cell.y));}
      const first=cellToWorld(crossing.cells[0].x,crossing.cells[0].y),lastCell=crossing.cells[crossing.cells.length-1],last=cellToWorld(lastCell.x,lastCell.y);
      river.bridges.push({x:(first.x+last.x)/2,z:(first.z+last.z)/2,length:crossing.cells.length*CELL,horizontal:crossing.dx!==0});
    }
    throw new Error('Map connectivity iteration limit');
  }

  function chooseKeyCells(grid, river) {
    const passable = makePassable(grid, river);
    const dist = bfsDistancesFrom(START_CELL.x, START_CELL.y, passable);
    const candidates = [];

    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (!passable(x, y)) continue;
        if (river && river.waterCells.has(cellKey(x, y))) continue;
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
        if(river&&[...river.landingCells||[]].some(key=>{const [bx,by]=key.split(',').map(Number);return Math.abs(bx-x)+Math.abs(by-y)<=1;}))continue;
        if (river && river.waterCells.has(cellKey(x, y))) continue;
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
      const blocked=new Set([...pits,cell].map(p=>cellKey(p.x,p.y)));
      const basePassable=makePassable(grid,river);
      const safe=(x,y)=>basePassable(x,y)&&!blocked.has(cellKey(x,y));
      const reached=bfsDistancesFrom(START_CELL.x,START_CELL.y,safe);
      let connected=true;
      for(let y=0;y<ROWS&&connected;y++)for(let x=0;x<COLS;x++){
        if(safe(x,y)&&reached[y][x]<0){connected=false;break;}
      }
      if(connected)pits.push(cell);
    }

    return pits;
  }

  function updateRiverFlow(river) {
    const distance=new Int32Array(COLS*ROWS).fill(-1),queue=[];
    const directions=[[1,0],[-1,0],[0,1],[0,-1]];
    const wet=(x,y)=>x>=0&&x<COLS&&y>=0&&y<ROWS&&river.waterCells.has(cellKey(x,y));
    // All cells across the main mouth share one level, so straight reaches
    // flow along the channel rather than diagonally towards a single cell.
    const exits=[];
    for(const key of river.waterCells){
      const [x,y]=key.split(',').map(Number);
      if(river.outlet==='south' ? y===ROWS-1 : x===COLS-1)exits.push([x,y]);
    }
    // East-facing tributary mouths must remain inlets: the main outlet is
    // the lowest east boundary reach (or the sole northern return reach).
    if(river.outlet!=='south'&&exits.length){
      const mainY=river.outletRow;
      if(mainY!==undefined)for(let i=exits.length-1;i>=0;i--)if(Math.abs(exits[i][1]-mainY)>1)exits.splice(i,1);
    }
    for(const [x,y] of exits){distance[y*COLS+x]=0;queue.push([x,y]);}
    for(let head=0;head<queue.length;head++){
      const [x,y]=queue[head];
      for(const [dx,dy] of directions){const nx=x+dx,ny=y+dy;
        if(wet(nx,ny)&&distance[ny*COLS+nx]<0){distance[ny*COLS+nx]=distance[y*COLS+x]+1;queue.push([nx,ny]);}
      }
    }
    const channelAxis=(x,y)=>{
      const span=(dx,dy)=>{let n=1;for(const sign of [-1,1])for(let step=1;wet(x+dx*step*sign,y+dy*step*sign);step++)n++;return n;};
      const width=span(1,0),height=span(0,1);
      return width<=3&&height>width*1.5 ? 2 : height<=3&&width>height*1.5 ? 1 : 0;
    };
    let field=new Float32Array(COLS*ROWS*2);
    for(const [x,y] of queue){
      const id=y*COLS+x;let fx=0,fy=0;
      if(distance[id]===0){fx=river.outlet==='south'?0:1;fy=river.outlet==='south'?1:0;}
      else for(const [dx,dy] of directions)if(wet(x+dx,y+dy)&&distance[(y+dy)*COLS+x+dx]<distance[id]){fx+=dx;fy+=dy;}
      const axis=channelAxis(x,y);if(axis===1)fy=0;if(axis===2)fx=0;
      const length=Math.hypot(fx,fy)||1;field[id*2]=fx/length;field[id*2+1]=fy/length;
    }
    for(let pass=0;pass<2;pass++){
      const next=field.slice();
      for(const [x,y] of queue){const id=y*COLS+x;let fx=field[id*2]*2,fy=field[id*2+1]*2;
        for(const [dx,dy] of directions)if(wet(x+dx,y+dy)){const k=((y+dy)*COLS+x+dx)*2;fx+=field[k];fy+=field[k+1];}
        const axis=channelAxis(x,y);if(axis===1)fy=0;if(axis===2)fx=0;
        const length=Math.hypot(fx,fy)||1;next[id*2]=fx/length;next[id*2+1]=fy/length;
      }field=next;
    }
    riverFlowPixels.fill(128);
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      let id=y*COLS+x;
      if(!wet(x,y)){
        const neighbour=directions.find(([dx,dy])=>wet(x+dx,y+dy));
        if(!neighbour)continue;id=(y+neighbour[1])*COLS+x+neighbour[0];
      }
      const i=(y*COLS+x)*4;
      riverFlowPixels[i]=Math.round((field[id*2]*.5+.5)*255);
      riverFlowPixels[i+1]=Math.round((field[id*2+1]*.5+.5)*255);
      riverFlowPixels[i+2]=128;riverFlowPixels[i+3]=255;
    }
    riverFlowMap.needsUpdate=true;
  }

  function riverLandCorners(x,y,river,waterCorner=false) {
    if(!river || river.waterCells.has(cellKey(x,y))!==waterCorner || river.landingCells?.has(cellKey(x,y)) || (waterCorner&&river.bridgeCells.has(cellKey(x,y))))return [];
    const w=cellToWorld(x,y),h=CELL/2,r=CELL*.32,result=[];
    for(const [sx,sz,angle] of [[-1,-1,Math.PI],[1,-1,-Math.PI/2],[1,1,0],[-1,1,Math.PI/2]]){
      if(waterCorner){
        if(x+sx<0||x+sx>=COLS||y+sz<0||y+sz>=ROWS)continue;
        if(river.waterCells.has(cellKey(x+sx,y))||river.waterCells.has(cellKey(x,y+sz)))continue;
      }else if(!river.waterCells.has(cellKey(x+sx,y))||!river.waterCells.has(cellKey(x,y+sz)))continue;
      const cx=w.x+sx*(h-r),cz=w.z+sz*(h-r),arc=[];
      for(let i=0;i<=5;i++){const a=angle+i*Math.PI/10;arc.push({x:cx+Math.cos(a)*r,z:cz+Math.sin(a)*r});}
      result.push({sx,sz,cx,cz,r,arc,tip:{x:w.x+sx*h,z:w.z+sz*h}});
    }
    return result;
  }
  function roundedRiverLandShape(x,y,river,waterCorner=false) {
    const w=cellToWorld(x,y),h=CELL/2,corners=riverLandCorners(x,y,river,waterCorner),points=[];
    for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      const corner=corners.find(c=>c.sx===sx&&c.sz===sz);
      points.push(...(corner?corner.arc:[{x:w.x+sx*h,z:w.z+sz*h}]));
    }
    return new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
  }

  function buildRiverVisuals() {
    riverCullMeshes.length = 0;
    lastFogCullCutoff = null;
    if (riverGroup) {
      riverGroup.traverse((o) => {
        if(o.userData.ownsRiverGeometry)o.geometry.dispose();
        if(o.userData.ownsRiverResources){o.geometry.dispose();o.material.dispose();}
        if (o.isInstancedMesh) o.dispose();
      });
      scene.remove(riverGroup);
      riverGroup = null;
    }
    if (!maze || !maze.river) return;
    updateRiverFlow(maze.river);

    const group = new THREE.Group();
    for (const key of maze.river.waterCells) {
      const [x, y] = key.split(',').map(Number);
      const w = cellToWorld(x, y);
      const rounded=riverLandCorners(x,y,maze.river,true).length>0;
      const water = new THREE.Mesh(rounded?new THREE.ShapeGeometry(roundedRiverLandShape(x,y,maze.river,true)):waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      if(rounded){water.position.y=-.35;water.userData.ownsRiverGeometry=true;}
      else{water.scale.set(CELL / 90, CELL / 6, 1);water.position.set(w.x,-.35,w.z);}
      water.receiveShadow = true;
      group.add(water);
    }

    // Continue every boundary opening beyond the playable map into the fog.
    const hx=COLS*CELL/2,hz=ROWS*CELL/2;
    const extendWater=(x,z,width,depth)=>{
      const water=new THREE.Mesh(waterGeo,waterMat);
      water.rotation.x=-Math.PI/2;water.position.set(x,-.35,z);
      water.scale.set(width/90,depth/6,1);group.add(water);
    };
    for(const key of maze.river.waterCells){
      const [x,y]=key.split(',').map(Number),w=cellToWorld(x,y);
      if(x===0)extendWater(-(120+hx)/2,w.z,120-hx,CELL);
      if(x===COLS-1)extendWater((120+hx)/2,w.z,120-hx,CELL);
      if(y===0)extendWater(w.x,-(120+hz)/2,CELL,120-hz);
      if(y===ROWS-1)extendWater(w.x,(120+hz)/2,CELL,120-hz);
    }

    const bankVertices = [], bankUvs = [], curvedWater=[];
    const bankSegment=(a,b,top=0)=>{
      bankVertices.push(a.x,top,a.z,b.x,top,b.z,b.x,-.55,b.z,a.x,top,a.z,b.x,-.55,b.z,a.x,-.55,a.z);
      const ua=(a.x+a.z)/1.2,ub=(b.x+b.z)/1.2;
      bankUvs.push(ua,0,ub,0,ub,-.55/1.2,ua,0,ub,-.55/1.2,ua,-.55/1.2);
    };
    // Close the exposed soil faces alongside exterior water. Without these
    // faces the sky shows through the gap between ground and water levels.
    for(const key of maze.river.waterCells){
      const [x,y]=key.split(',').map(Number),w=cellToWorld(x,y);
      if(x===0||x===COLS-1){
        const edge=x===0?-hx:hx, end=x===0?-120:120;
        for(const side of [-1,1]){
          if(maze.river.waterCells.has(cellKey(x,y+side)))continue;
          const z=w.z+side*CELL/2;
          bankSegment({x:edge,z},{x:end,z},-.04);
        }
      }
      if(y===0||y===ROWS-1){
        const edge=y===0?-hz:hz, end=y===0?-120:120;
        for(const side of [-1,1]){
          if(maze.river.waterCells.has(cellKey(x+side,y)))continue;
          const wx=w.x+side*CELL/2;
          bankSegment({x:wx,z:edge},{x:wx,z:end},-.04);
        }
      }
    }
    for (const key of maze.river.waterCells) {
      const [x,y]=key.split(',').map(Number),w=cellToWorld(x,y),h=CELL/2;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if(x+dx<0||x+dx>=COLS||y+dy<0||y+dy>=ROWS)continue;
        if(maze.river.waterCells.has(cellKey(x+dx,y+dy)))continue;
        let a={x:w.x+dx*h-dy*h,z:w.z+dy*h+dx*h},b={x:w.x+dx*h+dy*h,z:w.z+dy*h-dx*h};
        for(const c of [...riverLandCorners(x+dx,y+dy,maze.river),...riverLandCorners(x,y,maze.river,true)]){
          for(const endpoint of [a,b])if(Math.hypot(endpoint.x-c.tip.x,endpoint.z-c.tip.z)<.001){
            const arcEnd=c.arc.find(p=>dx?Math.abs(p.x-endpoint.x)<.001:Math.abs(p.z-endpoint.z)<.001);
            if(arcEnd){endpoint.x=arcEnd.x;endpoint.z=arcEnd.z;}
          }
        }
        bankSegment(a,b);
      }
    }
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)for(const c of riverLandCorners(x,y,maze.river)){
      // Arc normals face out of the land into the water.
      for(let i=0;i<c.arc.length-1;i++)bankSegment(c.arc[i],c.arc[i+1]);
      curvedWater.push(new THREE.Shape([c.tip,...c.arc.slice().reverse()].map(p=>new THREE.Vector2(p.x,-p.z))));
    }
    for(const key of maze.river.waterCells){const [x,y]=key.split(',').map(Number);
      for(const c of riverLandCorners(x,y,maze.river,true))for(let i=0;i<c.arc.length-1;i++)bankSegment(c.arc[i+1],c.arc[i]);
    }
    if(curvedWater.length){
      const patches=new THREE.Mesh(new THREE.ShapeGeometry(curvedWater),waterMat);
      patches.rotation.x=-Math.PI/2;patches.position.y=-.35;
      patches.userData.ownsRiverGeometry=true;patches.receiveShadow=true;group.add(patches);
    }
    // Bake distance to the actual straight and rounded bank segments.
    // Clamp sampling at map edges to continue the shade along exterior banks.
    bankShadePixels.fill(0);
    const shadeRadius=.85, sizeX=COLS*CELL, sizeZ=ROWS*CELL;
    for(let i=0;i<bankVertices.length;i+=18){
      const ax=bankVertices[i],az=bankVertices[i+2],bx=bankVertices[i+3],bz=bankVertices[i+5];
      const dx=bx-ax,dz=bz-az,lengthSq=dx*dx+dz*dz;
      if(lengthSq<1e-10)continue;
      const x0=Math.max(0,Math.floor(((Math.min(ax,bx)-shadeRadius)/sizeX+.5)*bankShadeSize));
      const x1=Math.min(bankShadeSize-1,Math.ceil(((Math.max(ax,bx)+shadeRadius)/sizeX+.5)*bankShadeSize));
      const z0=Math.max(0,Math.floor(((Math.min(az,bz)-shadeRadius)/sizeZ+.5)*bankShadeSize));
      const z1=Math.min(bankShadeSize-1,Math.ceil(((Math.max(az,bz)+shadeRadius)/sizeZ+.5)*bankShadeSize));
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
        const wx=((x+.5)/bankShadeSize-.5)*sizeX,wz=((z+.5)/bankShadeSize-.5)*sizeZ;
        const t=Math.max(0,Math.min(1,((wx-ax)*dx+(wz-az)*dz)/lengthSq));
        const d=Math.hypot(wx-ax-t*dx,wz-az-t*dz);
        const fade=Math.max(0,1-d/shadeRadius);
        const value=Math.round(255*fade*fade*(3-2*fade)),offset=(z*bankShadeSize+x)*4;
        bankShadePixels[offset]=Math.max(bankShadePixels[offset],value);
        // Bake irregular widths once; no procedural noise runs each frame.
        const variation=.5+.25*Math.sin(wx*4.7+wz*3.1)+.16*Math.sin(wx*9.3-wz*7.7);
        const blendWidth=.24+.16*variation;
        const blendFade=Math.max(0,Math.min(1,1-Math.max(0,d-.10)/blendWidth));
        const blendValue=Math.round(255*blendFade*blendFade*(3-2*blendFade));
        bankShadePixels[offset+1]=Math.max(bankShadePixels[offset+1],blendValue);
      }
    }
    bankShadeMap.needsUpdate=true;
    const bankGeo=new THREE.BufferGeometry();
    bankGeo.setAttribute('position',new THREE.Float32BufferAttribute(bankVertices,3));
    bankGeo.setAttribute('uv',new THREE.Float32BufferAttribute(bankUvs,2));
    bankGeo.computeVertexNormals();
    // Average duplicated corner normals and turn the upper edge towards the
    // ground normal. UV seams stay intact and no extra triangles are needed.
    const bankNormals=bankGeo.attributes.normal, bankPositions=bankGeo.attributes.position;
    const sharedNormals=new Map();
    const vertexKey=i=>`${bankPositions.getX(i).toFixed(4)},${bankPositions.getY(i).toFixed(4)},${bankPositions.getZ(i).toFixed(4)}`;
    for(let i=0;i<bankPositions.count;i++){
      const key=vertexKey(i);
      if(!sharedNormals.has(key))sharedNormals.set(key,new THREE.Vector3());
      sharedNormals.get(key).add(new THREE.Vector3(bankNormals.getX(i),bankNormals.getY(i),bankNormals.getZ(i)));
    }
    for(let i=0;i<bankPositions.count;i++){
      const n=sharedNormals.get(vertexKey(i)).clone().normalize();
      if(bankPositions.getY(i)>-.001)n.set(n.x*.22,1,n.z*.22).normalize();
      bankNormals.setXYZ(i,n.x,n.y,n.z);
    }
    const banks=new THREE.Mesh(bankGeo,new THREE.MeshStandardMaterial({
      map:bankSoilMap,bumpMap:bankSoilMap,bumpScale:.018,
      color:0xffffff,roughness:1,side:THREE.DoubleSide,
    }));
    banks.material.onBeforeCompile=shader=>{
      applyMapEdgeHaze(shader);
      shader.uniforms.bankRoadTexture=bankRoadTexture;
      shader.vertexShader='varying vec3 bankWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nbankWorld=(modelMatrix*vec4(position,1.0)).xyz;');
      shader.fragmentShader='varying vec3 bankWorld;\nuniform sampler2D bankRoadTexture;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        vec2 roadUv=vec2(bankWorld.x,-bankWorld.z)/${(CELL*3).toFixed(6)}+vec2(${(COLS/6).toFixed(6)},${(ROWS/6).toFixed(6)});
        vec3 roadColor=texture2D(bankRoadTexture,roadUv).rgb;
        vec3 soilColor=texture2D(map,vMapUv).rgb*vec3(.52,.40,.28);
        float edgeDepth=.12+.035*sin(bankWorld.x*2.13+bankWorld.z*1.71)
          +.022*sin(bankWorld.x*4.37-bankWorld.z*3.19+.8);
        float soilBlend=smoothstep(edgeDepth-.055,edgeDepth+.085,-bankWorld.y);
        diffuseColor.rgb*=mix(roadColor,soilColor,soilBlend);
      `);
    };
    banks.material.customProgramCacheKey=()=> 'bank-road-soil-world-v1';
    banks.userData.ownsRiverResources=true;banks.receiveShadow=true;group.add(banks);

    for (const bridge of maze.river.bridges) {
      const deck = new THREE.Mesh(bridgeDeckGeo, bridgeDeckMat);
      deck.castShadow = true;
      deck.receiveShadow = true;
      deck.position.set(bridge.x, 0, bridge.z);
      deck.scale.z = (bridge.length + 1.8) / 7.8;
      deck.rotation.y = bridge.horizontal ? Math.PI / 2 : 0;
      deck.receiveShadow = true;
      group.add(deck);
      for(const side of [-1,1]){
        // Embed the .7-deep support into the bank by .03: its river-facing
        // face must not coincide with the shoreline plane at length / 2.
        const along=side*(bridge.length/2+.38);
        const support=new THREE.Mesh(bridgeAbutmentGeo,bridgeAbutmentMat);
        support.position.set(bridge.x+(bridge.horizontal?along:0),-.36,bridge.z+(bridge.horizontal?0:along));
        support.rotation.y=bridge.horizontal?Math.PI/2:0;
        support.castShadow=support.receiveShadow=true;group.add(support);
      }

      for (const side of [-0.73, 0.73]) {
        const edge = new THREE.Mesh(bridgeEdgeGeo, bridgeEdgeMat);
        edge.position.set(bridge.x + (bridge.horizontal ? 0 : side), 0.07,
          bridge.z + (bridge.horizontal ? side : 0));
        edge.scale.z = (bridge.length + 1.8) / 7.8;
        edge.rotation.y = bridge.horizontal ? Math.PI / 2 : 0;
        group.add(edge);
      }
    }

    // забор по берегам и бортики мостов
    const postPositions = [];
    const railInstances = [];
    const addPosts = (x1, z1, x2, z2, height = 0.45, baseY = 0) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const count = Math.max(2, Math.ceil(len / 2.4) + 1);
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : i / (count - 1);
        postPositions.push({
          height, baseY,
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
        angle: -Math.atan2(z2-z1,x2-x1),
        y,
      });
    };

    const visualFenceSegments=maze.river.fenceSegments.map(segment=>({...segment}));
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)for(const c of riverLandCorners(x,y,maze.river)){
      let joined=0;
      for(const segment of visualFenceSegments){
        for(const [xKey,zKey] of [['x1','z'],['x2','z2']]){
          if(Math.hypot(segment[xKey]-c.tip.x,segment[zKey]-c.tip.z)>.001)continue;
          const horizontal=Math.abs(segment.z-segment.z2)<.001;
          const end=c.arc.find(p=>horizontal?Math.abs(p.z-segment[zKey])<.001:Math.abs(p.x-segment[xKey])<.001);
          if(end){segment[xKey]=end.x;segment[zKey]=end.z;joined++;}
        }
      }
      if(joined===2){const a=c.arc[0],b=c.arc[c.arc.length-1];visualFenceSegments.push({x1:a.x,z:a.z,x2:b.x,z2:b.z});}
    }
    for (const segment of visualFenceSegments) {
      addPosts(segment.x1, segment.z, segment.x2, segment.z2, 0.45);
      addRail(segment.x1, segment.z, segment.x2, segment.z2, 0.18);
      addRail(segment.x1, segment.z, segment.x2, segment.z2, 0.34);
    }

    for (const bridge of maze.river.bridges) {
      for (const side of [-0.69, 0.69]) {
        const x1 = bridge.x + (bridge.horizontal ? -bridge.length / 2 : side);
        const x2 = bridge.x + (bridge.horizontal ? bridge.length / 2 : side);
        const z1 = bridge.z + (bridge.horizontal ? side : -bridge.length / 2);
        const z2 = bridge.z + (bridge.horizontal ? side : bridge.length / 2);
        addPosts(x1, z1, x2, z2, 0.45, 0.06);
        addRail(x1, z1, x2, z2, 0.24);
        addRail(x1, z1, x2, z2, 0.40);
      }
    }

    if (postPositions.length) {
      const posts = new THREE.InstancedMesh(fencePostGeo, fenceMat, postPositions.length);
      posts.castShadow = true;
      const m = new THREE.Matrix4();
      postPositions.forEach((p, i) => {
        m.makeScale(1, p.height / 0.9, 1);
        m.setPosition(p.x, p.baseY + p.height / 2, p.z);
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
        quat.setFromAxisAngle(new THREE.Vector3(0,1,0),r.angle);
        m.compose(pos, quat, scale);
        rails.setMatrixAt(i, m);
      });
      rails.instanceMatrix.needsUpdate = true;
      rails.computeBoundingSphere();
      group.add(rails);
    }

    // Batch water by spatial region, retaining the exact original triangles.
    // Hundreds of cell meshes otherwise each require a separate WebGL draw.
    const waterChunks=new Map();
    for(const mesh of [...group.children]){
      if(!mesh.isMesh||mesh.material!==waterMat)continue;
      mesh.updateMatrix();
      const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrix);
      const positions=geo.attributes.position,normals=geo.attributes.normal,uvs=geo.attributes.uv;
      for(let i=0;i<positions.count;i+=3){
        const cx=(positions.getX(i)+positions.getX(i+1)+positions.getX(i+2))/3;
        const cz=(positions.getZ(i)+positions.getZ(i+1)+positions.getZ(i+2))/3;
        const key=Math.floor(cx/16)+','+Math.floor(cz/16);
        let chunk=waterChunks.get(key);
        if(!chunk){chunk={position:[],normal:[],uv:[]};waterChunks.set(key,chunk);}
        for(let j=i;j<i+3;j++){
          chunk.position.push(positions.getX(j),positions.getY(j),positions.getZ(j));
          chunk.normal.push(normals.getX(j),normals.getY(j),normals.getZ(j));
          chunk.uv.push(uvs.getX(j),uvs.getY(j));
        }
      }
      geo.dispose();group.remove(mesh);
      if(mesh.userData.ownsRiverGeometry)mesh.geometry.dispose();
    }
    for(const chunk of waterChunks.values()){
      const geo=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv'])geo.setAttribute(name,new THREE.Float32BufferAttribute(chunk[name],name==='uv'?2:3));
      geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,waterMat);
      mesh.receiveShadow=true;mesh.userData.ownsRiverGeometry=true;
      mesh.boundingSphere=geo.boundingSphere;
      group.add(mesh);riverCullMeshes.push(mesh);
    }
    // Fence sections are culled as small spatial batches, avoiding a scan
    // and GPU buffer rewrite for every individual rail on camera movement.
    for(const mesh of [...group.children])if(mesh.isInstancedMesh){
      const chunks=new Map(),matrix=new THREE.Matrix4();
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);
        const key=Math.floor(matrix.elements[12]/12)+','+Math.floor(matrix.elements[14]/12);
        if(!chunks.has(key))chunks.set(key,[]);
        chunks.get(key).push(matrix.clone());
      }
      for(const matrices of chunks.values()){
        const batch=new THREE.InstancedMesh(mesh.geometry,mesh.material,matrices.length);
        matrices.forEach((m,i)=>batch.setMatrixAt(i,m));
        batch.castShadow=mesh.castShadow;batch.receiveShadow=mesh.receiveShadow;
        batch.userData.cullWholeChunk=true;
        batch.computeBoundingSphere();group.add(batch);riverCullMeshes.push(batch);
      }
      group.remove(mesh);mesh.dispose();
    }
    riverGroup = group;
    scene.add(group);
  }

  function buildPitVisuals() {
    if (pitShafts) {
      scene.remove(pitShafts);
      pitShafts.dispose();
      pitShafts = null;
    }
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
    // Real openings through both surface planes expose the recessed shaft.
    for (const [surface, width, height] of [[floor, COLS * CELL, ROWS * CELL], [ground, 240, 240]]) {
      const rectangle=(x0,y0,x1,y1)=>{
        const shape=new THREE.Shape();shape.moveTo(x0,y0);shape.lineTo(x1,y0);shape.lineTo(x1,y1);shape.lineTo(x0,y1);shape.closePath();return shape;
      };
      const shapes=[];
      if(surface===ground){
        const hx=COLS*CELL/2,hz=ROWS*CELL/2;
        for(const sx of [-1,1])for(const sz of [-1,1]){
          shapes.push(rectangle(sx<0?-width/2:hx,sz<0?-height/2:hz,sx<0?-hx:width/2,sz<0?-hz:height/2));
        }
        for(let y=0;y<ROWS;y++)for(const side of [-1,1]){
          if(maze?.river?.waterCells.has(cellKey(side<0?0:COLS-1,y)))continue;
          const z=cellToWorld(0,y).z;
          shapes.push(rectangle(side<0?-width/2:hx,-z-CELL/2,side<0?-hx:width/2,-z+CELL/2));
        }
        for(let x=0;x<COLS;x++)for(const side of [-1,1]){
          if(maze?.river?.waterCells.has(cellKey(x,side<0?0:ROWS-1)))continue;
          const wx=cellToWorld(x,0).x;
          shapes.push(rectangle(wx-CELL/2,side<0?hz:-height/2,wx+CELL/2,side<0?height/2:-hz));
        }
      }else{
        // Continuous land strips leave the complete river bed open, including
        // branches and junctions, without adding overlapping rectangular holes.
        for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;){
          if(maze?.river?.waterCells.has(cellKey(x,y))){
            for(const c of riverLandCorners(x,y,maze.river,true))shapes.push(new THREE.Shape([c.tip,...c.arc.slice().reverse()].map(p=>new THREE.Vector2(p.x,-p.z))));
            x++;continue;
          }
          if(riverLandCorners(x,y,maze?.river).length){
            shapes.push(roundedRiverLandShape(x,y,maze.river));x++;continue;
          }
          const start=x;
          while(x<COLS&&!riverLandCorners(x,y,maze?.river).length&&!maze?.river?.waterCells.has(cellKey(x,y)))x++;
          const left=cellToWorld(start,y),right=cellToWorld(x-1,y);
          const shape=rectangle(left.x-CELL/2,-left.z-CELL/2,right.x+CELL/2,-left.z+CELL/2);
          for(const pit of pits){
            if(pit.world.x<left.x-CELL/2||pit.world.x>right.x+CELL/2||Math.abs(pit.world.z-left.z)>CELL/2)continue;
            const hole=new THREE.Path();hole.absarc(pit.world.x,-pit.world.z,PIT_RADIUS,0,Math.PI*2,true);shape.holes.push(hole);
          }
          shapes.push(shape);
        }
      }
      const geometry = new THREE.ShapeGeometry(shapes, 16);
      const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i)/width+.5, position.getY(i)/height+.5);
      surface.geometry.dispose();
      surface.geometry = geometry;
    }
    if (!pits.length) return;

    pitDisks = new THREE.InstancedMesh(pitDiskGeo, pitDiskMat, pits.length);
    pitRims = new THREE.InstancedMesh(pitRimGeo, pitRimMat, pits.length);
    pitShafts = new THREE.InstancedMesh(pitShaftGeo, pitShaftMat, pits.length);
    pitRims.renderOrder = 1;

    const m = new THREE.Matrix4();
    pits.forEach((pit, i) => {
      m.makeTranslation(pit.world.x, -PIT_DEPTH, pit.world.z);
      pitDisks.setMatrixAt(i, m);
      m.makeTranslation(pit.world.x, 0, pit.world.z);
      pitShafts.setMatrixAt(i, m);
      m.makeTranslation(pit.world.x, 0.034, pit.world.z);
      pitRims.setMatrixAt(i, m);
    });

    pitDisks.instanceMatrix.needsUpdate = true;
    pitShafts.instanceMatrix.needsUpdate = true;
    pitShafts.computeBoundingSphere();
    pitRims.instanceMatrix.needsUpdate = true;
    pitDisks.computeBoundingSphere();
    pitRims.computeBoundingSphere();
    scene.add(pitDisks);
    scene.add(pitShafts);
    scene.add(pitRims);
  }

  function buildScenery(wallCells, houseKeys, houses, grid, landmarkKeys) {
    fogCullMeshes.length = 0;
    if (sceneryGroup) {
      sceneryGroup.traverse((o) => {
        if (o.userData.ownsGeometry) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
      });
      scene.remove(sceneryGroup);
      sceneryGroup = null;
    }

    const group = new THREE.Group();
    const hedgeCells = wallCells.filter(
      (c) => !houseKeys.has(cellKey(c.x, c.y)) && !landmarkKeys.has(cellKey(c.x, c.y))
    );
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    // Изгороди нарезаем на пространственные чанки: камера видит только
    // коридор вокруг игрока, остальные чанки отсекаются по bounding sphere
    // и их инстансы вообще не попадают в отрисовку.
    const CHUNK_CELLS = 10;
    const hedgeChunks = new Map();
    for (const cell of hedgeCells) {
      const key = ((cell.x / CHUNK_CELLS) | 0) + "," + ((cell.y / CHUNK_CELLS) | 0);
      let bucket = hedgeChunks.get(key);
      if (!bucket) {
        bucket = [];
        hedgeChunks.set(key, bucket);
      }
      bucket.push(cell);
    }

    const addInstanced = (mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      fogCullMeshes.push(mesh);
    };

    const baseGreens = [0xbac5af, 0xc3cdb7, 0xcbd2bd, 0xb2beaa, 0xc8d1b9];
    const foliageGreens = [0xd2dac6, 0xdde3d0, 0xe4e7d6, 0xc9d3bf, 0xe5e8d1, 0xd5dec8];
    const leafTints = [0x466a30, 0x557a3a, 0x3e5f2b, 0x648a44, 0x4e7234, 0x5d823e];
    const blobsPerHedge = 5;
    const cardsPerHedge = 2;
    const upAxis = new THREE.Vector3(0, 1, 0);
    const euler = new THREE.Euler();

    for (const cells of hedgeChunks.values()) {
      const count = cells.length;

      // основа живых изгородей
      const base = new THREE.InstancedMesh(hedgeBaseGeo, hedgeBaseMat, count);
      base.castShadow = true;
      base.receiveShadow = true;
      cells.forEach((cell, i) => {
        m.makeTranslation(cell.world.x, 0.34, cell.world.z);
        base.setMatrixAt(i, m);
        base.setColorAt(i, color.setHex(baseGreens[(Math.random() * baseGreens.length) | 0]));
      });
      addInstanced(base);

      // округлые кустики сверху
      const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, count * blobsPerHedge);
      foliage.receiveShadow = true;
      let index = 0;
      for (const cell of cells) {
        for (let j = 0; j < blobsPerHedge; j++) {
          const ox = (Math.random() - 0.5) * 1.3;
          const oz = (Math.random() - 0.5) * 1.3;
          const s = 0.78 + Math.random() * 0.52;
          pos.set(
            cell.world.x + ox,
            0.55 + Math.random() * 0.5,
            cell.world.z + oz
          );
          quat.setFromAxisAngle(upAxis, Math.random() * Math.PI);
          scale.set(s, s * (0.75 + Math.random() * 0.35), s);
          m.compose(pos, quat, scale);
          foliage.setMatrixAt(index, m);
          color.setHex(foliageGreens[(Math.random() * foliageGreens.length) | 0]);
          foliage.setColorAt(index, color);
          index += 1;
        }
      }
      addInstanced(foliage);

      // листовые «карточки» для живой поверхности кустов
      const leafCards = new THREE.InstancedMesh(leafCardGeo, leafCardMat, count * cardsPerHedge);
      // карточки тонкие: тень на них почти не читается, а выборка теневой карты
      // в шейдере стоит дорого — поэтому тени они не принимают
      leafCards.receiveShadow = false;
      index = 0;
      for (const cell of cells) {
        for (let j = 0; j < cardsPerHedge; j++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.42 + Math.random() * 0.5;
          pos.set(
            cell.world.x + Math.cos(angle) * radius,
            0.32 + Math.random() * 0.85,
            cell.world.z + Math.sin(angle) * radius
          );
          euler.set(
            (Math.random() - 0.5) * 1.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 1.5
          );
          quat.setFromEuler(euler);
          const s = 0.9 + Math.random() * 0.5;
          scale.set(s, s, s);
          m.compose(pos, quat, scale);
          leafCards.setMatrixAt(index, m);
          color.setHex(leafTints[(Math.random() * leafTints.length) | 0]);
          leafCards.setColorAt(index, color);
          index += 1;
        }
      }
      addInstanced(leafCards);
    }

    // Низкие дома разбиваем на участки; высотки со всеми деталями держим
    // в отдельной группе, которая никогда не отсекается по туману.
    const houseChunks = new Map();
    for (const house of houses) {
      house.style = house.style || (!house.highRise && ((house.x * 73 + house.y * 37) % 7 < 5) ? "wood" : "stone");
      const key = house.highRise ? "highRise" :
        Math.floor(house.x / CHUNK_CELLS) + "," + Math.floor(house.y / CHUNK_CELLS) + ":" + house.style;
      let bucket = houseChunks.get(key);
      if (!bucket) houseChunks.set(key, bucket = []);
      bucket.push(house);
    }
    const sceneryRoot = group;
    for (const [chunkKey, houses] of houseChunks) {
      const wooden = houses[0].style === "wood";
      const surface = wooden ? woodSurface : houseSurface;
      const group = new THREE.Group();
      group.name = chunkKey === "highRise" ? "high-rise-always-visible" : "houses-" + chunkKey;
      sceneryRoot.add(group);
      const variants = [
        { sx: 1.0, sy: 0.8, sz: 1.0, floors: 1, roof: "pyramid", roofH: 0.82, chimney: true },
        { sx: 0.86, sy: 0.8, sz: 1.04, floors: 1, roof: "gable", roofH: 0.72, chimney: true },
        { sx: 0.78, sy: 1.6, sz: 0.78, floors: 2, roof: "pyramid", roofH: 0.9, chimney: true },
        { sx: 0.94, sy: 0.8, sz: 0.94, floors: 1, roof: "pyramid", roofH: 0.62, chimney: false },
      ];
      const highVariants = [
        { sx: 0.72, sy: 2.4, sz: 0.72, floors: 3, roof: "flat", roofH: 0.12, chimney: true },
        { sx: 0.82, sy: 2.4, sz: 0.82, floors: 3, roof: "pyramid", roofH: 0.78, chimney: false },
        { sx: 0.66, sy: 3.2, sz: 0.66, floors: 4, roof: "pyramid", roofH: 0.5, chimney: false, spire: true },
        { sx: 1.0, sy: 1.6, sz: 0.78, floors: 2, roof: "flat", roofH: 0.12, chimney: true },
      ];
      const bodyColors = [0xe8dcc4, 0xdccbaa, 0xf0e6d1, 0xcbb894, 0xe2cfa6];
      const highBodyColors = [0xd8d4c8, 0xc7d2d5, 0xe7d3ab, 0xcbb6a2, 0xbec8c2];
      // The roof texture already contains clay colour; avoid tinting it twice.
      const roofColors = [0xffffff, 0xeee4d9, 0xe2d5c9, 0xf5e8db, 0xe5dcd2];
      const highRoofColors = [0xeee8e1, 0xded7ce, 0xf2e3d4, 0xe4ddd6, 0xf0e8df];
      const pyramidRoofs = [];
      const gableRoofs = [];
      const gableWalls = [];
      const flatRoofs = [];
      const spireInstances = [];
      const chimneyInstances = [];

      // Per-house facade selection stays in the same instanced draw call.
      const bodyGeometry = houseBodyGeo.clone();
      const facade = new THREE.InstancedBufferAttribute(new Float32Array(houses.length * 4), 4);
      bodyGeometry.setAttribute("houseFacade", facade);
      const bodies = new THREE.InstancedMesh(bodyGeometry, surface.material, houses.length);
      bodies.userData.ownsGeometry = true;
      bodies.userData.batchGeometry = houseBodyGeo.uuid;
      bodies.name = "medieval-house-bodies";
      bodies.castShadow = true;
      bodies.receiveShadow = true;

      houses.forEach((house, i) => {
        const wx = house.world.x;
        const wz = house.world.z;
        const highRise = !!house.highRise;
        const pool = wooden ? [variants[0]] : highRise ? highVariants : variants;
        const selectedVariant = pool[(Math.random() * pool.length) | 0];
        const variant = wooden ? { ...selectedVariant, roof: "gable" } : selectedVariant;
        house.floors = variant.floors;

        const bodyW = 1.8 * variant.sx;
        const bodyD = 1.8 * variant.sz;
        const bodyH = 1.0 * variant.sy;
        const roofH = variant.roofH;
        const roofPalette = highRise ? highRoofColors : roofColors;
        const roofColor = roofPalette[(Math.random() * roofPalette.length) | 0];

        pos.set(wx, bodyH / 2, wz);
        quat.identity();
        scale.set(variant.sx, variant.sy, variant.sz);
        m.compose(pos, quat, scale);
        bodies.setMatrixAt(i, m);
        bodies.setColorAt(
          i,
          color.setHex(
            (highRise ? highBodyColors : bodyColors)[
              (Math.random() * (highRise ? highBodyColors : bodyColors).length) | 0
            ]
          )
        );

        if (variant.roof === "pyramid") {
          pyramidRoofs.push({
            x: wx,
            z: wz,
            y: bodyH + roofH / 2 - 0.02,
            sx: variant.sx,
            sy: roofH / 0.82,
            sz: variant.sz,
            color: roofColor,
          });
        } else if (variant.roof === "gable") {
          const gableHeight = roofH - 0.02;
          // Extend the slopes past the wall, keeping the stone end flush with
          // the facade and its top edge exactly against the roof plane.
          const slopeHeight = gableHeight * (bodyW + 0.2) / bodyW;
          gableRoofs.push({
            normalVariant: house.roofNormalVariant ?? ((house.x * 37 + house.y * 19) % 3 + 3) % 3,
            x: wx,
            z: wz,
            y: bodyH + gableHeight - slopeHeight,
            sx: bodyW + 0.2,
            sy: slopeHeight,
            sz: bodyD + 0.2,
            color: roofColor,
          });
          gableWalls.push({
            x: wx, z: wz, y: bodyH,
            sx: bodyW, sy: gableHeight, sz: bodyD,
            color: color.getHex(),
          });
        } else {
          flatRoofs.push({
            x: wx,
            z: wz,
            y: bodyH + 0.06,
            sx: bodyW + 0.16,
            sy: 0.12,
            sz: bodyD + 0.16,
            color: roofColor,
          });
        }

        if (variant.spire) {
          spireInstances.push({
            x: wx,
            z: wz,
            // Roof apex is lowered by 0.02; embed the spire base by 0.18
            // so its full width meets the slopes rather than floating above.
            y: bodyH + roofH - 0.02 - 0.18 + 0.35,
            color: roofColor,
          });
        }

        if (variant.chimney && !wooden) {
          chimneyInstances.push({
            x: wx + 0.22 * variant.sx,
            y: bodyH + (variant.roof === "flat" ? 0.35 : roofH * 0.72),
            z: wz + 0.22 * variant.sz,
          });
        }

        const sides = [];
        if (house.x > 0 && grid[house.y][house.x - 1] === 0) sides.push({ axis: "x", sign: -1 });
        if (house.x < COLS - 1 && grid[house.y][house.x + 1] === 0) sides.push({ axis: "x", sign: 1 });
        if (house.y > 0 && grid[house.y - 1][house.x] === 0) sides.push({ axis: "z", sign: -1 });
        if (house.y < ROWS - 1 && grid[house.y + 1][house.x] === 0) sides.push({ axis: "z", sign: 1 });

        const kinds = [2, 2, 2, 2];
        const openFaces = sides.map(side => side.axis === "x" ? (side.sign > 0 ? 0 : 1) : (side.sign > 0 ? 2 : 3));
        const facadeSeed = house.x * 17 + house.y * 31 + i;
        const entryFace = openFaces.length ? openFaces[facadeSeed % openFaces.length] : 2;
        if (wooden) {
          house.entranceType = house.entranceType || ((house.x * 13 + house.y * 7 + i) % 2 ? "side" : "gable");
          // The square footprint lets the roof turn while the door keeps facing
          // a passage. Gable ends initially face +/-Z.
          const entryOnZ = entryFace >= 2;
          const roofTurn = (house.entranceType === "gable") === entryOnZ ? 0 : Math.PI / 2;
          gableRoofs[gableRoofs.length - 1].rotationY = roofTurn;
          gableWalls[gableWalls.length - 1].rotationY = roofTurn;
        }
        // Kind 0: entrance + windows on every floor; kind 1: floors 2/4;
        // kind 2: blank; kind 3: paired windows on floors 1/3/5.
        kinds[entryFace] = 0;
        if (variant.floors > 1) {
          const otherFaces = [0, 1, 2, 3].filter(face => face !== entryFace);
          const adjacentOpen = otherFaces.filter(face => openFaces.includes(face) && Math.floor(face / 2) !== Math.floor(entryFace / 2));
          const otherOpen = otherFaces.filter(face => openFaces.includes(face));
          const adjacent = otherFaces.filter(face => Math.floor(face / 2) !== Math.floor(entryFace / 2));
          const candidates = adjacentOpen.length ? adjacentOpen : otherOpen.length ? otherOpen : adjacent;
          kinds[candidates[facadeSeed % candidates.length]] = 1;
        }
        openFaces.forEach(face => {
          if (kinds[face] === 2) kinds[face] = variant.floors > 1 && (facadeSeed + face) % 2 ? 1 : 3;
        });
        const tiles = [bodyD, bodyD, bodyW, bodyW].map((width, face) => surface.facadeTile(width, bodyH, kinds[face], wooden && face < 2 ? 1 : 0));
        facade.setXYZW(i, ...tiles);
      });

      bodies.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      bodies.computeBoundingSphere();
      group.add(bodies);

      const buildRoofMesh = (geo, items, material = (wooden ? woodRoofMat : houseRoofMat)) => {
        if (!items.length) return;
        const batchGeometry = geo.uuid;
        const hasRoofVariants = wooden && material === woodRoofMat;
        if (hasRoofVariants) {
          geo = geo.clone();
          geo.setAttribute("roofNormalVariant", new THREE.InstancedBufferAttribute(
            Float32Array.from(items, item => item.normalVariant || 0), 1));
        }
        const mesh = new THREE.InstancedMesh(geo, material, items.length);
        mesh.userData.batchGeometry = batchGeometry;
        if (hasRoofVariants) mesh.userData.ownsGeometry = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        items.forEach((r, i) => {
          pos.set(r.x, r.y, r.z);
          quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.rotationY || 0);
          scale.set(r.sx, r.sy, r.sz);
          m.compose(pos, quat, scale);
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, color.setHex(r.color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      };


      buildRoofMesh(houseRoofGeo, pyramidRoofs);
      buildRoofMesh(houseGableRoofGeo, gableRoofs);
      buildRoofMesh(houseGableEndGeo, gableWalls, wooden ? woodGableMat : houseGableMat);
      buildRoofMesh(houseFlatRoofGeo, flatRoofs);

      if (spireInstances.length) {
        const spires = new THREE.InstancedMesh(
          houseSpireGeo,
          houseRoofMat,
          spireInstances.length
        );
        spires.castShadow = true;
        spireInstances.forEach((s, i) => {
          pos.set(s.x, s.y, s.z);
          quat.identity();
          scale.set(1, 1, 1);
          m.compose(pos, quat, scale);
          spires.setMatrixAt(i, m);
          spires.setColorAt(i, color.setHex(s.color));
        });
        spires.instanceMatrix.needsUpdate = true;
        if (spires.instanceColor) spires.instanceColor.needsUpdate = true;
        spires.computeBoundingSphere();
        group.add(spires);
      }

      if (chimneyInstances.length) {
        const chimneys = new THREE.InstancedMesh(
          houseChimneyGeo,
          houseChimneyMat,
          chimneyInstances.length
        );
        chimneys.castShadow = true;
        chimneyInstances.forEach((c, i) => {
          m.makeTranslation(c.x, c.y, c.z);
          chimneys.setMatrixAt(i, m);
        });
        chimneys.instanceMatrix.needsUpdate = true;
        chimneys.computeBoundingSphere();
        group.add(chimneys);
      }

      if (chunkKey !== "highRise") fogCullMeshes.push(...group.children);
    }

    // Batch identical ordinary-house parts across chunks. Per-instance culling
    // below still preserves exactly the same visible set and facade attributes.
    const batches = new Map();
    for (const houseGroup of group.children) {
      if (!houseGroup.name.startsWith("houses-")) continue;
      for (const mesh of houseGroup.children) {
        const key = mesh.material.uuid + ":" + (mesh.userData.batchGeometry || mesh.geometry.uuid);
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(mesh);
      }
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const first = meshes[0], count = meshes.reduce((n, mesh) => n + mesh.count, 0);
      const geometry = first.geometry.clone();
      const attributes = Object.entries(first.geometry.attributes).filter(([,a]) => a.isInstancedBufferAttribute);
      for (const [name, attribute] of attributes) {
        geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new attribute.array.constructor(count * attribute.itemSize), attribute.itemSize, attribute.normalized));
      }
      const merged = new THREE.InstancedMesh(geometry, first.material, count);
      merged.name = first.name;
      merged.userData.ownsGeometry = true;
      merged.castShadow = first.castShadow;
      merged.receiveShadow = first.receiveShadow;
      if (first.instanceColor) merged.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      let offset = 0;
      for (const mesh of meshes) {
        merged.instanceMatrix.array.set(mesh.instanceMatrix.array.subarray(0, mesh.count * 16), offset * 16);
        if (merged.instanceColor) merged.instanceColor.array.set(mesh.instanceColor.array.subarray(0, mesh.count * 3), offset * 3);
        for (const [name, attribute] of attributes) geometry.attributes[name].array.set(mesh.geometry.attributes[name].array.subarray(0, mesh.count * attribute.itemSize), offset * attribute.itemSize);
        offset += mesh.count;
        mesh.parent.remove(mesh);
        const index = fogCullMeshes.indexOf(mesh);
        if (index !== -1) fogCullMeshes.splice(index, 1);
        if (mesh.userData.ownsGeometry) mesh.geometry.dispose();
        mesh.dispose();
      }
      merged.computeBoundingSphere();
      group.add(merged);
      fogCullMeshes.push(merged);
    }
    sceneryGroup = group;
    scene.add(group);
  }

  function isBeyondFog(sphere, cameraPosition, direction, cutoff) {
    // Все зарегистрированные меши и их родители имеют единичные трансформации:
    // матрицы инстансов уже содержат мировые координаты.
    const depth = (sphere.center.x - cameraPosition.x) * direction.x +
      (sphere.center.y - cameraPosition.y) * direction.y +
      (sphere.center.z - cameraPosition.z) * direction.z;
    return depth - sphere.radius > cutoff;
  }

  const lastFogCullProjection = new THREE.Matrix4();
  let lastFogCullMesh = null;
  let lastFogCullCutoff = null;
  function updateFogCulling() {
    // При запекании теней нужны и дальние объекты. Ориентиры, их маяки,
    // высотки, небо и игровые предметы вообще не входят в fogCullMeshes.
    const density = scene.fog && scene.fog.density;
    const enabled = mode !== "preview" && density > 0 && !renderer.shadowMap.needsUpdate;
    const cutoff = enabled ? Math.sqrt(-Math.log(FOG_CULL_RESIDUAL)) / density : Infinity;
    if (enabled) {
      camera.getWorldDirection(fogCullDirection);
      fogCullProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (lastFogCullMesh === fogCullMeshes[0] && lastFogCullCutoff === cutoff &&
          lastFogCullProjection.equals(fogCullProjection)) return;
      lastFogCullProjection.copy(fogCullProjection);
      lastFogCullMesh = fogCullMeshes[0];
      lastFogCullCutoff = cutoff;
      fogCullFrustum.setFromProjectionMatrix(fogCullProjection);
    } else {
      lastFogCullCutoff = null;
    }
    for (const mesh of fogCullMeshes.concat(riverCullMeshes)) {
      mesh.visible = !enabled || (
        !isBeyondFog(mesh.boundingSphere, camera.position, fogCullDirection, cutoff) &&
        fogCullFrustum.intersectsSphere(mesh.boundingSphere)
      );
      if (mesh.visible && mesh.isInstancedMesh && !mesh.userData.cullWholeChunk) compactVisibleInstances(mesh, enabled, cutoff);
    }
  }

  function compactVisibleInstances(mesh, enabled, cutoff) {
    let data = fogCullInstances.get(mesh);
    if (!data) {
      // Сохраняем оригиналы один раз: после уплотнения буфер содержит только
      // видимую часть. Геометрия, цвета и общая boundingSphere не меняются.
      const matrices = mesh.instanceMatrix.array.slice();
      const colors = mesh.instanceColor ? mesh.instanceColor.array.slice() : null;
      const spheres = [];
      const matrix = new THREE.Matrix4();
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      for (let i = 0; i < mesh.count; i++) {
        matrix.fromArray(matrices, i * 16);
        const sphere = mesh.geometry.boundingSphere.clone().applyMatrix4(matrix);
        sphere.radius += 0.0001; // запас на округление у границы кадра
        spheres.push(sphere);
      }
      // Additional instanced data (facade UV selections) must follow the same
      // permutation as matrices and colors when invisible instances disappear.
      const attributes = Object.values(mesh.geometry.attributes)
        .filter(attribute => attribute.isInstancedBufferAttribute)
        .map(attribute => ({ attribute, original: attribute.array.slice() }));
      data = { matrices, colors, spheres, attributes, ids: new Int32Array(mesh.count) };
      for (let i = 0; i < mesh.count; i++) data.ids[i] = i;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      for (const { attribute } of attributes) attribute.setUsage(THREE.DynamicDrawUsage);
      fogCullInstances.set(mesh, data);
    }

    let count = 0;
    let changed = false;
    for (let id = 0; id < data.spheres.length; id++) {
      const sphere = data.spheres[id];
      if (enabled && (isBeyondFog(sphere, camera.position, fogCullDirection, cutoff) ||
          !fogCullFrustum.intersectsSphere(sphere))) continue;
      if (data.ids[count] !== id) {
        for (let j = 0; j < 16; j++) {
          mesh.instanceMatrix.array[count * 16 + j] = data.matrices[id * 16 + j];
        }
        if (data.colors) {
          for (let j = 0; j < 3; j++) {
            mesh.instanceColor.array[count * 3 + j] = data.colors[id * 3 + j];
          }
        }
        for (const { attribute, original } of data.attributes) {
          for (let j = 0; j < attribute.itemSize; j++) {
            attribute.array[count * attribute.itemSize + j] = original[id * attribute.itemSize + j];
          }
        }
        data.ids[count] = id;
        changed = true;
      }
      count++;
    }
    mesh.count = count;
    mesh.visible = count > 0;
    // Неподвижная камера не вызывает повторной загрузки тех же матриц на GPU.
    if (changed) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      for (const { attribute } of data.attributes) attribute.needsUpdate = true;
    }
  }

  function prepareStartPlaza(grid, river) {
    const candidates = [];
    const centerX = (COLS - 1) / 2;
    const centerY = (ROWS - 1) / 2;
    for (let y = 3; y < ROWS - 3; y++) {
      for (let x = 3; x < COLS - 3; x++) {
        if (grid[y][x] !== 0) continue;
        let dry = true;
        // Keep the whole plaza and a one-cell margin clear of all water.
        for (let dy = -2; dy <= 2 && dry; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (river && river.waterCells.has(cellKey(x + dx, y + dy))) {
              dry = false;
              break;
            }
          }
        }
        if (dry && gridDistance({ x, y }, GOAL_CELL) > 3) {
          candidates.push({ x, y, distance: (x - centerX) ** 2 + (y - centerY) ** 2 });
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) throw new Error("No dry start plaza available");
    const start = candidates[0];
    START_CELL.x = start.x;
    START_CELL.y = start.y;
    for (let y = start.y - 1; y <= start.y + 1; y++) {
      for (let x = start.x - 1; x <= start.x + 1; x++) grid[y][x] = 0;
    }
  }

  function buildMaze() {
    const grid = generateGrid();
    const river = carveRiver(grid);
    prepareStartPlaza(grid, river);
    connectMapLayout(grid, river);
    const keyCells = chooseKeyCells(grid, river);
    const pitCells = choosePitCells(grid, river, keyCells);

    const wallCells = [];
    const walls = [];

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] !== 1) continue;

        const world = cellToWorld(x, y);
        wallCells.push({ x, y, world });

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
          minX: segment.x1 - 0.06,
          maxX: segment.x2 + 0.06,
          minZ: segment.z - 0.06,
          maxZ: segment.z2 + 0.06,
        });
      }

      // бортики мостов, чтобы с моста нельзя было свалиться в воду
      for (const bridge of river.bridges) {
        for (const side of [-0.69, 0.69]) {
          walls.push({
            minX: bridge.x + (bridge.horizontal ? -bridge.length / 2 : side - 0.035),
            maxX: bridge.x + (bridge.horizontal ? bridge.length / 2 : side + 0.035),
            minZ: bridge.z + (bridge.horizontal ? side - 0.035 : -bridge.length / 2),
            maxZ: bridge.z + (bridge.horizontal ? side + 0.035 : bridge.length / 2),
          });
        }
      }
    }

    const landmarkCells = chooseLandmarkCells(grid);
    const landmarkKeys = new Set(
      landmarkCells.map((cell) => cellKey(cell.x, cell.y))
    );

    const houseKeys = new Set();
    const houses = [];
    const shuffledWalls = shuffleList([...wallCells]);

    for (const cell of shuffledWalls) {
      if (houses.length >= 140) break;
      if (Math.random() > 0.28) continue;
      if (landmarkKeys.has(cellKey(cell.x, cell.y))) continue;

      const hasOpenNeighbor =
        (cell.x > 0 && grid[cell.y][cell.x - 1] === 0) ||
        (cell.x < COLS - 1 && grid[cell.y][cell.x + 1] === 0) ||
        (cell.y > 0 && grid[cell.y - 1][cell.x] === 0) ||
        (cell.y < ROWS - 1 && grid[cell.y + 1][cell.x] === 0);

      if (!hasOpenNeighbor) continue;
      if (houses.some((h) => gridDistance(h, cell) <= 1)) continue;

      houses.push(cell);
      houseKeys.add(cellKey(cell.x, cell.y));
    }

    const highRiseSpots = [];
    for (const house of shuffleList([...houses])) {
      if (highRiseSpots.length >= 14) break;
      if (Math.random() > 0.45) continue;
      if (highRiseSpots.some((spot) => gridDistance(spot, house) < 6)) continue;
      house.highRise = true;
      highRiseSpots.push(house);
    }

    buildScenery(wallCells, houseKeys, houses, grid, landmarkKeys);

    const goalWorld = cellToWorld(GOAL_CELL.x, GOAL_CELL.y);

    maze = {
      grid,
      walls,
      wallIndex: buildWallIndex(walls),
      start: cellToWorld(START_CELL.x, START_CELL.y),
      goal: goalWorld,
      keyCells,
      pits: pitCells.map((c) => ({ ...c, world: cellToWorld(c.x, c.y) })),
      river,
      houseCells: houseKeys,
      landmarkCells,
    };

    goalGroup.position.set(goalWorld.x, 0, goalWorld.z);
    buildRiverVisuals();
    buildPitVisuals();
    placeLandmarks(landmarkCells);
    // мир пересобран — печём карту теней заново (один раз за уровень)
    renderer.shadowMap.needsUpdate = true;
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
    boost = 1;
    boosting = false;
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
    boosting = false;
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
    bankRoadTexture.value = floorTexDay;
    floor.material.normalMap = floorTexDay.userData.normalMap;
    floor.material.needsUpdate = true;

    trimMat.color.set(0x31545c);
    ground.material.color.set(0x6f7d57);
    waterDay.value = 1;

    hemi.color.set(0xffffff);
    hemi.groundColor.set(0xc0b49d);
    // чуть выше, чем в игре: раньше обзорную карту подсвечивал отдельный
    // hemisphere-свет, от которого мы отказались ради экономии шейдеров
    hemi.intensity = 2.8;

    dirLight.color.set(0xfff1d6);
    dirLight.intensity = 2.6;

    renderer.toneMappingExposure = 1.05;
    scene.fog.color.set(0xcfe6f2);
    scene.fog.density = 0.0025;

    sunGroup.visible = false;
    moonSprite.visible = false;
    starField.visible = false;

    houseBodyMat.emissiveIntensity = 0.12;
    ball.material.emissiveIntensity = 0.2;
    dust.material.opacity = 0.12;
  }

  function updatePreviewCountdown() {
    if (mode !== "preview") return;
    const seconds = Math.max(0, Math.ceil((previewEndsAt - performance.now()) / 1000));
    previewCountEl.textContent = String(seconds);
    if (seconds <= 0) finishPreview();
  }

  function updatePreviewCamera() {
    const orbit = previewOrbit;
    orbit.phi = Math.max(0.28, Math.min(1.16, orbit.phi));
    orbit.radius = Math.max(62, Math.min(190, orbit.radius));

    const sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      Math.cos(orbit.theta) * sinPhi * orbit.radius,
      Math.cos(orbit.phi) * orbit.radius,
      Math.sin(orbit.theta) * sinPhi * orbit.radius
    );
    camera.lookAt(0, 1, 0);
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

    previewOrbit.theta = -0.82;
    previewOrbit.phi = 0.95;
    previewOrbit.radius = 128;
    previewOrbit.dragging = false;
    camera.far = 300;
    camera.fov = 68;
    camera.updateProjectionMatrix();
    updatePreviewCamera();
    canvas.style.cursor = "grab";

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
    previewOrbit.dragging = false;
    canvas.style.cursor = "";

    previewUi.classList.add("hidden");
    clearPreviewMarkers();
    hud.classList.remove("hidden");

    camera.far = 130;
    camera.updateProjectionMatrix();
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
    hintsLeft = 10;
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

  const hudValues = new WeakMap();
  function setHudText(element, value) {
    if (hudValues.get(element) === value) return;
    hudValues.set(element, value);
    element.textContent = value;
  }
  let hudKeyCount = -1;
  let hudBoostPercent = -1;
  let hudBoostLow = null;
  function updateHud() {
    setHudText(timerEl, formatTime(time));
    setHudText(levelEl, String(level));
    const best = bestByLevel[level];
    setHudText(bestEl, typeof best === "number" ? formatTime(best) : "\u2014");
    if (hudKeyCount !== keysCollected) {
      hudKeyCount = keysCollected;
      const pips = keyPipsEl.children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle("filled", i < keysCollected);
      keyPipsEl.setAttribute("aria-label", `\u0421\u043e\u0431\u0440\u0430\u043d\u043e \u043a\u043b\u044e\u0447\u0435\u0439: ${keysCollected} \u0438\u0437 ${KEY_COUNT}`);
    }
    const percent = Math.round(boost * 100), low = boost < .25;
    if (boostFillEl && hudBoostPercent !== percent) {
      hudBoostPercent = percent;
      boostFillEl.style.width = `${percent}%`;
    }
    if (boostBlockEl && hudBoostLow !== low) {
      hudBoostLow = low;
      boostBlockEl.classList.toggle("low", low);
    }
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

    for (let i = 1; i < path.length && count < maxArrows; i += 2) {
      const a = path[i];
      const prev = path[i - 1];
      const next = i < path.length - 1 ? path[i + 1] : a;

      let dirX = Math.sign(next.x - a.x);
      let dirZ = Math.sign(next.y - a.y);
      if (dirX === 0 && dirZ === 0) {
        dirX = Math.sign(a.x - prev.x);
        dirZ = Math.sign(a.y - prev.y);
      }

      const world = cellToWorld(a.x, a.y);
      const isBridgeCell = maze.river && maze.river.waterCells.has(cellKey(a.x, a.y));
      const py = isBridgeCell ? 0.1 : 0.045;

      const arrow = new THREE.Mesh(hintArrowGeo, hintPathMat);
      arrow.position.set(world.x, py, world.z);
      arrow.rotation.y = Math.atan2(-dirX, -dirZ);
      arrow.scale.setScalar(0.72);
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
        ? `Ближайший ключ — ${target.dist} шагов. Стрелки на тропинке — 15 сек.`
        : `Выход — ${target.dist} шагов. Стрелки на тропинке — 15 сек.`,
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
    scene.fog.density = day ? 0.035 : 0.07;

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
    bankRoadTexture.value = floor.material.map;
    floor.material.normalMap = floor.material.map.userData.normalMap;
    floor.material.needsUpdate = true;

    trimMat.color.set(day ? 0x31545c : 0x2a6678);
    ground.material.color.set(day ? 0x6f7d57 : 0x0a110b);
    waterDay.value = day ? 1 : 0;

    ballLight.intensity = day ? 3 : 16;
    camLight.intensity = day ? 12 : 26;
    ball.material.emissiveIntensity = day ? 0.2 : 0.32;
    houseBodyMat.emissiveIntensity = day ? 0.12 : 1.25;
    dust.material.color.set(day ? 0xffffff : 0x9fd2ff);
    dust.material.opacity = day ? 0.14 : 0.55;

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
    const character = CHARACTERS.find((c) => c.id === playerKind) || CHARACTERS[0];
    const isBall = character.id === "ball";

    if (isBall) {
      const url = ballPreviewUrl(ball.material.map);
      if (url) {
        ballIconEl.style.backgroundImage = `url("${url}")`;
        ballPreviewEl.style.backgroundImage = `url("${url}")`;
      }
      ballIconEl.textContent = "";
      ballPreviewEl.textContent = "";
      ballIconEl.classList.remove("animal");
      ballPreviewEl.classList.remove("animal");
      ballIconEl.style.background = "";
      ballPreviewEl.style.background = "";
    } else {
      ballIconEl.textContent = character.icon;
      ballPreviewEl.textContent = character.icon;
      ballIconEl.classList.add("animal");
      ballPreviewEl.classList.add("animal");
      ballIconEl.style.backgroundImage = "none";
      ballPreviewEl.style.backgroundImage = "none";
      ballIconEl.style.background = character.accent;
      ballPreviewEl.style.background = character.accent;
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
    for (const el of characterGrid.children) {
      el.classList.toggle("active", el.dataset.player === playerKind);
    }
    ballStyleSection.classList.toggle("hidden", !isBall);
  }

  function syncPlayerCharacter() {
    const isBall = playerKind === "ball";
    ball.visible = isBall;

    for (const [kind, group] of Object.entries(animalGroups)) {
      group.visible = kind === playerKind;
    }

    const target = isBall ? ball : animalGroups[playerKind];
    if (target) {
      target.add(ballLight);
      ballLight.position.set(0, isBall ? 0.7 : 0.95, isBall ? 0 : 0.12);
    }

    localStorage.setItem("labirint.player.v1", playerKind);

    if (!isBall) {
      const group = animalGroups[playerKind];
      if (group) {
        group.position.set(ball.position.x, ball.position.y - GROUND_Y, ball.position.z);
        group.rotation.y = camYaw;
      }
    }

    syncBallUI();
  }

  function setPlayerKind(kind) {
    if (!CHARACTERS.some((c) => c.id === kind)) return;
    playerKind = kind;
    syncPlayerCharacter();
    const character = CHARACTERS.find((c) => c.id === kind);
    showToast(`Герой: ${character.label}`, "good");
  }

  function saveBallStyle() {
    localStorage.setItem("labirint.ball.v1", JSON.stringify({ color: ballColor, pattern: ballPattern }));
  }

  function applyBallStyle(save = true) {
    const old = ball.material.map;
    const tex = makeBallTexture(ballColor, ballPattern);
    ball.material.map = tex;
    const canonical =
      ballPattern === "soccer" ||
      ballPattern === "basketball" ||
      ballPattern === "tennis" ||
      ballPattern === "volleyball" ||
      ballPattern === "cat" ||
      ballPattern === "dog" ||
      ballPattern === "lion" ||
      ballPattern === "tiger" ||
      ballPattern === "leopard";
    ball.material.emissive.set(canonical ? 0x141414 : shade(ballColor, -0.1));
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

    for (const item of CHARACTERS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "character-btn";
      btn.dataset.player = item.id;
      btn.innerHTML = `<span class="char-icon">${item.icon}</span><span>${item.label}</span>`;
      btn.addEventListener("click", () => setPlayerKind(item.id));
      characterGrid.appendChild(btn);
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
  function buildWallIndex(walls) {
    const buckets = new Map();
    // Расширяем препятствия на радиус игрока: достаточно искать в одной
    // ячейке. Длинные ограждения попадают во все пересекаемые ячейки.
    walls.forEach((wall, id) => {
      const minX = Math.floor((wall.minX - BALL_R) / CELL);
      const maxX = Math.floor((wall.maxX + BALL_R) / CELL);
      const minZ = Math.floor((wall.minZ - BALL_R) / CELL);
      const maxZ = Math.floor((wall.maxZ + BALL_R) / CELL);
      for (let x = minX; x <= maxX; x++) {
        let column = buckets.get(x);
        if (!column) buckets.set(x, column = new Map());
        for (let z = minZ; z <= maxZ; z++) {
          let bucket = column.get(z);
          if (!bucket) column.set(z, bucket = []);
          bucket.push(id);
        }
      }
    });
    return buckets;
  }

  function resolveCollisions(pos, v) {
    const r2 = BALL_R * BALL_R;

    let lastId = -1;
    let bucket;
    let cursor = 0;
    while (true) {
      const column = maze.wallIndex.get(Math.floor(pos.x / CELL));
      const nextBucket = column && column.get(Math.floor(pos.z / CELL));
      if (!nextBucket) break;
      // Выталкивание может перенести игрока в другую ячейку. Обновляем
      // кандидатов, сохраняя порядок исходного полного обхода стен.
      if (bucket !== nextBucket) {
        bucket = nextBucket;
        cursor = 0;
        while (cursor < bucket.length && bucket[cursor] <= lastId) cursor++;
      }
      if (cursor === bucket.length) break;
      const i = bucket[cursor++];
      lastId = i;
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
    const cx = Math.round(x / CELL + (COLS - 1) / 2);
    const cy = Math.round(z / CELL + (ROWS - 1) / 2);
    if (!r.waterCells.has(cellKey(cx, cy))) {
      const inRoundedCut=riverLandCorners(cx,cy,r).some(c=>
        (x-c.cx)*c.sx>0&&(z-c.cz)*c.sz>0&&Math.hypot(x-c.cx,z-c.cz)>c.r);
      if(!inRoundedCut)return false;
    }
    if(riverLandCorners(cx,cy,r,true).some(c=>(x-c.cx)*c.sx>0&&(z-c.cz)*c.sz>0&&Math.hypot(x-c.cx,z-c.cz)>c.r))return false;
    for (const bridge of r.bridges) {
      const along = bridge.horizontal ? x - bridge.x : z - bridge.z;
      const across = bridge.horizontal ? z - bridge.z : x - bridge.x;
      if (Math.abs(across) <= 0.72 && Math.abs(along) <= bridge.length / 2 + 0.9) return false;
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

    const wantsBoost =
      (keys.has("ShiftLeft") || keys.has("ShiftRight")) && drive > 0 && boost > 0;
    boosting = wantsBoost;

    if (wantsBoost) {
      boost = Math.max(0, boost - dt * 0.42);
    } else {
      boost = Math.min(1, boost + dt * 0.22);
    }

    const currentAccel = wantsBoost ? ACCEL * 1.7 : ACCEL;
    const currentMaxSpeed = wantsBoost ? MAX_SPEED * 1.45 : MAX_SPEED;

    if (drive !== 0) {
      vel.x += fx * drive * currentAccel * dt;
      vel.y += fz * drive * currentAccel * dt;
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
    if (speed > currentMaxSpeed) {
      vel.multiplyScalar(currentMaxSpeed / speed);
    }

    ball.position.x += vel.x * dt;
    ball.position.z += vel.y * dt;

    resolveCollisions(ball.position, vel);

    // прыжок
    if (jumpRequested) {
      if (grounded) {
        ballVY = JUMP_VELOCITY * (boosting ? 1.12 : 1);
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

    const targetFov = mode === "playing" && boosting ? 74 : 68;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
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

  // управление обзорной камерой: вращение мышью и зум колесом
  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "preview" || e.button !== 0) return;
    previewOrbit.dragging = true;
    previewOrbit.lastX = e.clientX;
    previewOrbit.lastY = e.clientY;
    canvas.style.cursor = "grabbing";
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!previewOrbit.dragging || mode !== "preview") return;
    const dx = e.clientX - previewOrbit.lastX;
    const dy = e.clientY - previewOrbit.lastY;
    previewOrbit.lastX = e.clientX;
    previewOrbit.lastY = e.clientY;
    previewOrbit.theta -= dx * 0.005;
    previewOrbit.phi = Math.max(0.28, Math.min(1.16, previewOrbit.phi + dy * 0.004));
    updatePreviewCamera();
  });

  const endPreviewDrag = () => {
    if (!previewOrbit.dragging) return;
    previewOrbit.dragging = false;
    if (mode === "preview") canvas.style.cursor = "grab";
  };
  canvas.addEventListener("pointerup", endPreviewDrag);
  canvas.addEventListener("pointercancel", endPreviewDrag);
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (mode !== "preview") return;
      e.preventDefault();
      previewOrbit.radius = Math.max(62, Math.min(190, previewOrbit.radius + e.deltaY * 0.06));
      updatePreviewCamera();
    },
    { passive: false }
  );

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
    // Размер canvas применится в animate перед renderer.render().
  });

  // ---------- Цикл ----------
  function updateAnimalCharacter(dt, t) {
    if (playerKind === "ball") return;
    const group = animalGroups[playerKind];
    if (!group) return;

    const speed = vel.length();
    const run = Math.min(1, speed / 3.2);
    const airborne = !grounded && mode === "playing";
    const data = group.userData;

    if (speed > 0.15 && (mode === "playing" || mode === "falling" || mode === "lost")) {
      data.phase += dt * (7 + speed * 1.7);
    }

    const phase = data.phase;
    const swing = run * 0.65;

    data.legs.forEach((leg, index) => {
      let target;
      if (airborne) {
        target = index < 2 ? 0.55 : -0.45;
      } else {
        target = Math.sin(phase + leg.offset) * swing;
      }
      leg.group.rotation.x += (target - leg.group.rotation.x) * Math.min(1, 14 * dt);
    });

    if (data.head) {
      data.head.rotation.x = Math.sin(phase * 2) * 0.05 * run;
    }
    if (data.tail) {
      data.tail.rotation.y = Math.sin(t * 2.2 + phase * 0.4) * 0.4;
    }

    const bob = grounded ? Math.abs(Math.sin(phase)) * 0.018 * run : 0;
    group.position.set(ball.position.x, ball.position.y - GROUND_Y + bob, ball.position.z);
    group.rotation.y = camYaw;
  }

  const clock = new THREE.Clock();

  // ---------- Отладка: счётчик FPS ----------
  // Считаем по меткам requestAnimationFrame, а не по dt из clock:
  // dt в цикле ограничен 0.05 с и скрыл бы длинные фризы.
  let fpsFrames = 0;
  let fpsWindowStart = null;
  let frameCpuTotalMs = 0;
  let lastRenderMs = 0;
  let frameLogicTotalMs = 0;
  let frameCullTotalMs = 0;
  let frameRenderTotalMs = 0;
  let lastLogicMs = 0;
  let lastCullMs = 0;
  let performanceSnapshot = null;
  let slowStreak = 0;
  let fastStreak = 0;
  let renderMsAvg = 0;
  let lastScaleChangeAt = -Infinity;
  let scaleSettleFrames = 0;

  const RENDER_SCALE_STEP = 0.1;
  const SLOW_RENDER_MS = 9;
  const FAST_RENDER_MS = 4.5;
  const SLOW_STREAK_LIMIT = 3;
  // Вверх поднимаемся неохотнее, чем опускаемся: иначе разрешение «пинг-понгует»
  // между двумя ступенями, и картинка то размыливается, то становится резкой.
  const FAST_STREAK_LIMIT = 12;
  const SCALE_COOLDOWN_MS = 1200;
  // После пересоздания буфера canvas его замеры не показательны — пропускаем их.
  const SCALE_SETTLE_FRAMES = 2;

  function applyRenderScale() {
    // setPixelRatio()/setSize() пересоздают буфер canvas и стирают его содержимое.
    // Вызываем их только при реальном изменении и только до отрисовки кадра
    // (см. animate), иначе готовая картинка пропадёт до следующего кадра.
    const width = window.innerWidth;
    const height = window.innerHeight;
    let changed = false;
    if (renderScale !== appliedRenderScale) {
      appliedRenderScale = renderScale;
      // setPixelRatio сам пересчитывает размер canvas через setSize.
      renderer.setPixelRatio(renderScale);
      changed = true;
    }
    if (width !== appliedWidth || height !== appliedHeight) {
      appliedWidth = width;
      appliedHeight = height;
      renderer.setSize(width, height);
      changed = true;
    }
    if (changed) scaleSettleFrames = SCALE_SETTLE_FRAMES;
  }

  // Динамическое разрешение — страховка для слабых GPU. Ориентируемся на время
  // самой отрисовки, а не на интервал кадров: интервал ограничен частотой
  // композитора (в окне приложения это ~30 Гц), и по нему разрешение падало бы
  // без всякой пользы, только размывая картинку.
  //
  // Вызывается перед renderer.render(): менять размер canvas после отрисовки
  // нельзя — буфер очищается, и до следующего кадра виден чёрный экран.
  function adaptRenderScale(now) {
    // Первые кадры после смены размера canvas не измеряем: в них входит
    // пересоздание буфера, из-за чего замер был бы завышен.
    if (scaleSettleFrames > 0) {
      scaleSettleFrames -= 1;
      return;
    }
    if (!lastRenderMs) return;
    if (now - lastScaleChangeAt < SCALE_COOLDOWN_MS) return;

    // Сглаживаем замеры: одиночный всплеск (GC, загрузка текстуры) не должен
    // дёргать разрешение. Время renderer.render() — это CPU-отправка команд,
    // а не время GPU, поэтому шум особенно заметен.
    renderMsAvg = renderMsAvg > 0
      ? renderMsAvg + (lastRenderMs - renderMsAvg) * 0.2
      : lastRenderMs;

    if (renderMsAvg > SLOW_RENDER_MS) {
      slowStreak += 1;
      fastStreak = 0;
    } else if (renderMsAvg < FAST_RENDER_MS) {
      fastStreak += 1;
      slowStreak = 0;
    } else {
      slowStreak = 0;
      fastStreak = 0;
    }

    let nextScale = renderScale;
    if (slowStreak >= SLOW_STREAK_LIMIT && renderScale > MIN_RENDER_SCALE) {
      nextScale = Math.max(MIN_RENDER_SCALE, +(renderScale - RENDER_SCALE_STEP).toFixed(2));
    } else if (fastStreak >= FAST_STREAK_LIMIT && renderScale < MAX_RENDER_SCALE) {
      nextScale = Math.min(MAX_RENDER_SCALE, +(renderScale + RENDER_SCALE_STEP).toFixed(2));
    }
    if (nextScale === renderScale) return;

    renderScale = nextScale;
    slowStreak = 0;
    fastStreak = 0;
    renderMsAvg = 0;
    lastScaleChangeAt = now;
    // Размер canvas применит animate перед renderer.render().
  }

  function updateFpsMeter(now, cpuMs) {
    if (!fpsEl) return;
    if (fpsWindowStart === null) {
      fpsWindowStart = now;
      return;
    }
    fpsFrames += 1;
    frameCpuTotalMs += cpuMs;
    frameLogicTotalMs += lastLogicMs;
    frameCullTotalMs += lastCullMs;
    frameRenderTotalMs += lastRenderMs;
    const elapsed = now - fpsWindowStart;
    if (elapsed < 500) return;

    const fps = (fpsFrames * 1000) / elapsed;
    // Среднее время выполнения игрового кадра на CPU, без ожидания rAF.
    // GPU работает асинхронно: это НЕ время выполнения команд видеокартой.
    const ms = frameCpuTotalMs / fpsFrames;
    performanceSnapshot = {
      fps, cpuMs: ms,
      logicMs: frameLogicTotalMs / fpsFrames,
      cullingMs: frameCullTotalMs / fpsFrames,
      renderSubmitMs: frameRenderTotalMs / fpsFrames,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      renderScale,
    };
    const triangles = renderer.info.render.triangles.toLocaleString("ru-RU");
    fpsCompactText = `${fps < 100 ? fps.toFixed(1) : Math.round(fps)} fps`;
    fpsDetailedText = `${fps < 100 ? fps.toFixed(1) : Math.round(fps)} fps · CPU ${ms.toFixed(2)} ms · игра ${performanceSnapshot.logicMs.toFixed(2)} / отсечение ${performanceSnapshot.cullingMs.toFixed(2)} / рендер ${performanceSnapshot.renderSubmitMs.toFixed(2)} ms · ${renderer.info.render.calls} выз. · ${renderScale.toFixed(2)}x · ${triangles} треуг.`;
    fpsEl.textContent = fpsExpanded ? fpsDetailedText : fpsCompactText;
    fpsEl.classList.toggle("low", fps < 30);
    fpsFrames = 0;
    frameCpuTotalMs = 0;
    frameLogicTotalMs = frameCullTotalMs = frameRenderTotalMs = 0;
    fpsWindowStart = now;
  }

  function animate(now) {
    const frameStart = performance.now();
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

    updateAnimalCharacter(dt, t);
    ballLight.intensity =
      (theme === "day" ? 3 : 16) * (mode === "playing" && boosting ? 1.7 : 1);

    // пятно-тень под мячиком/героем: растёт и бледнеет в прыжке
    const airHeight = Math.max(0, ballY - GROUND_Y);
    const airK = Math.min(1, airHeight / 1.9);
    const shadowSize = playerKind === "ball" ? 1.05 : 1.45;
    heroShadow.visible = mode !== "falling";
    heroShadow.position.set(ball.position.x, 0.075, ball.position.z);
    heroShadow.scale.setScalar(shadowSize * (1 + airK * 0.35));
    heroShadow.material.opacity = 0.85 * (1 - airK * 0.75);

    // ускорение: лёгкое свечение мячика
    ball.material.emissiveIntensity =
      (theme === "day" ? 0.2 : 0.32) * (mode === "playing" && boosting ? 1.7 : 1);

    // анимация выхода
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    goalPad.material.opacity = 0.32 + pulse * 0.3;
    const ringScale = 1 + pulse * 0.07;
    goalRing.scale.setScalar(ringScale);

    // ключи парят и вращаются
    keyItems.forEach((item, i) => {
      if (!item.group.visible) return;
      item.crystal.rotation.y = t * 1.35 + i * 1.7;
      item.crystal.rotation.x = Math.sin(t * 1.1 + i) * 0.18;
      item.crystal.position.y = 0.75 + Math.sin(t * 2.2 + i * 2.1) * 0.09;
      item.ring.scale.setScalar(1 + Math.sin(t * 3 + i * 1.4) * 0.08);
    });

    // вода и кромки ям
    waterTime.value = t;

    // анимация ориентиров
    if (windmillBlades) windmillBlades.rotation.z += dt * 0.8;
    landmarkBeacons.forEach((beacon, index) => {
      const pulse = Math.sin(t * 2 + beacon.phase + index);
      beacon.sprite.material.opacity = 0.68 + pulse * 0.22;
      const scale = beacon.baseScale * (1 + pulse * 0.08);
      beacon.sprite.scale.set(scale, scale, 1);
    });

    updateHintPath();

    // небо следует за камерой, как бесконечно далёкое
    skyGroup.position.copy(camera.position);

    // пыль медленно плывёт
    dust.rotation.y = t * 0.008;

    // Полностью закрытый оверлеем кадр не рисуем (под ним всё равно ничего
    // не видно). Исключение — кадр, на котором нужно запечь карту теней.
    const uiCovers =
      helpOpen ||
      !overlay.classList.contains("hidden") ||
      !winOverlay.classList.contains("hidden") ||
      !loseOverlay.classList.contains("hidden");
    if (uiCovers && !renderer.shadowMap.needsUpdate) {
      fpsWindowStart = null;
      fpsFrames = 0;
      frameCpuTotalMs = 0;
      frameLogicTotalMs = frameCullTotalMs = frameRenderTotalMs = 0;
      // Замеры до паузы устарели: после неё не на что опираться.
      slowStreak = 0;
      fastStreak = 0;
      renderMsAvg = 0;
      lastRenderMs = 0;
      if (fpsEl && fpsEl.textContent !== "Рендер на паузе") {
        fpsEl.textContent = "Рендер на паузе";
        fpsEl.classList.remove("low");
      }
      return;
    }

    const cullStart = performance.now();
    lastLogicMs = cullStart - frameStart;
    updateFogCulling();
    lastCullMs = performance.now() - cullStart;
    // Разрешение меняем строго до render(): setPixelRatio()/setSize() очищают
    // буфер canvas, и после отрисовки готовая картинка пропала бы до следующего
    // кадра (на слабом GPU это выглядит как чёрная вспышка).
    adaptRenderScale(performance.now());
    applyRenderScale();
    const renderStart = performance.now();
    floorReliefCenter.set(ball.position.x, ball.position.z);
    renderer.render(scene, camera);
    lastRenderMs = performance.now() - renderStart;
    updateFpsMeter(now ?? frameStart, performance.now() - frameStart);
  }

  // ---------- Отладочный доступ (можно удалить) ----------
  window.__lab = {
    THREE,
    houseSurface,
    scene,
    camera,
    renderer,
    getPerformance: () => performanceSnapshot && { ...performanceSnapshot },
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
  syncPlayerCharacter();
  buildMaze();
  updateHud();
  updateCamera(1, true);
  animate();
})();
