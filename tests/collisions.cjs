const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const source = fs.readFileSync(require('node:path').join(__dirname, '../static/game.js'), 'utf8');
const indexSource = source.slice(source.indexOf('  function buildWallIndex('), source.indexOf('  function resolveCollisions('));
const resolver = source.slice(source.indexOf('  function resolveCollisions('), source.indexOf('  function isOverPit('));
// Reference: original full scan, with exactly the same narrow-phase response.
const reference = resolver.replace(
  /    let lastId = -1;[\s\S]*?      const w = maze.walls\[i\];/,
  '    for (let i = 0; i < maze.walls.length; i++) {\n      const w = maze.walls[i];'
);
assert.notEqual(reference, resolver);
const context = vm.createContext({});
vm.runInContext('const CELL = 2, BALL_R = 0.38; let maze; function setMaze(value) { maze = value; }\n' + indexSource + resolver + reference.replace('function resolveCollisions', 'function referenceCollisions'), context);
let seed = 123456;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}

let cases = 0;
let sample;
let lastMaze;
for (let level = 0; level < 10; level++) {
  const walls = [];
  for (let x = -23; x <= 23; x++) {
    for (let z = -23; z <= 23; z++) {
      if (random() < 0.5) walls.push({ minX: x * 2 - 1, maxX: x * 2 + 1, minZ: z * 2 - 1, maxZ: z * 2 + 1 });
    }
  }
  // Long river banks and thin bridge rails, including crossing bucket edges.
  walls.push({ minX: -45, maxX: -1, minZ: 20.94, maxZ: 21.06 });
  walls.push({ minX: 1, maxX: 45, minZ: 20.94, maxZ: 21.06 });
  for (const x of [-0.88, 0.88]) walls.push({ minX: x - 0.035, maxX: x + 0.035, minZ: 21, maxZ: 27 });
  lastMaze = { walls, wallIndex: context.buildWallIndex(walls) };
  context.setMaze(lastMaze);
  const positions = Array.from({ length: 10000 }, () => ({ x: random() * 104 - 52, z: random() * 104 - 52 }));
  for (const wall of walls) {
    for (const x of [wall.minX - 0.38, wall.minX, wall.maxX, wall.maxX + 0.38]) {
      for (const z of [wall.minZ - 0.38, wall.minZ, wall.maxZ, wall.maxZ + 0.38]) positions.push({ x, z });
    }
  }
  for (const position of positions) {
    const a = { ...position }, b = { ...position };
    const va = { x: random() * 20 - 10, z: random() * 20 - 10 }, vb = { ...va };
    context.resolveCollisions(a, va);
    context.referenceCollisions(b, vb);
    assert.deepEqual(a, b);
    assert.deepEqual(va, vb);
    cases++;
  }
  sample = positions;
}
// Informational CPU benchmark; this does not measure rendering or FPS.
function bench(fn) {
  const start = performance.now();
  for (let repeat = 0; repeat < 5; repeat++) {
    for (const p of sample) fn({ ...p }, { x: 2, z: -3 });
  }
  return performance.now() - start;
}
bench(context.resolveCollisions);
bench(context.referenceCollisions);
const full = bench(context.referenceCollisions);
const indexed = bench(context.resolveCollisions);
console.log(`${cases} collision cases matched exactly across 10 rebuilt indexes.`);
console.log(`CPU benchmark: full scan ${full.toFixed(1)} ms; indexed ${indexed.toFixed(1)} ms; ${(full / indexed).toFixed(2)}x.`);
console.log(`Walls: ${lastMaze.walls.length}; max bucket: ${Math.max(...[...lastMaze.wallIndex.values()].flatMap(c => [...c.values()].map(b => b.length)))}`);
