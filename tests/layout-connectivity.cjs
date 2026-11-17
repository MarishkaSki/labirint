const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../static/game.js'),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const ctx=vm.createContext({assert,console});
const constants=['COLS','ROWS','CELL','KEY_COUNT','RIVER_ROWS'].map(n=>source.match(new RegExp('  const '+n+' = [^;]+;'))[0]).join('\n');
vm.runInContext(constants+slice('  const START_CELL =','  function updateRiverFlow(')+slice('  function prepareStartPlaza(','  function buildMaze()'),ctx);
vm.runInContext(`let total=0,added=0;for(let seed=1;seed<=100;seed++){
 let state=seed;Math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 const grid=generateGrid(),river=carveRiver(grid);prepareStartPlaza(grid,river);const before=river?river.bridges.length:0;
 connectMapLayout(grid,river);added+=(river?river.bridges.length:0)-before;
 const keys=chooseKeyCells(grid,river),pits=choosePitCells(grid,river,keys),blocked=new Set(pits.map(p=>cellKey(p.x,p.y)));
 const base=makePassable(grid,river),safe=(x,y)=>base(x,y)&&!blocked.has(cellKey(x,y));
 const d=bfsDistancesFrom(START_CELL.x,START_CELL.y,safe);
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(safe(x,y)){assert(d[y][x]>=0,'isolated cell seed '+seed+' at '+x+','+y);total++;}

 if(river){
   assert.equal(river.landingCells.size>0,true);
   for(const key of river.landingCells){const [x,y]=key.split(',').map(Number);assert(safe(x,y),'landing must be a road without a pit');assert(!river.waterCells.has(key),'landing must be dry');}
   const barriers=river.fenceSegments.map(s=>({minX:s.x1-.06,maxX:s.x2+.06,minZ:s.z-.06,maxZ:s.z2+.06}));
   for(const b of river.bridges)for(const side of [-.88,.88])barriers.push({minX:b.x+(b.horizontal?-b.length/2:side-.035),maxX:b.x+(b.horizontal?b.length/2:side+.035),minZ:b.z+(b.horizontal?side-.035:-b.length/2),maxZ:b.z+(b.horizontal?side+.035:b.length/2)});
   const seen=new Set([cellKey(START_CELL.x,START_CELL.y)]),q=[START_CELL];
   for(let i=0;i<q.length;i++){const a=q[i],wa=cellToWorld(a.x,a.y);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=a.x+dx,y=a.y+dy,key=cellKey(x,y);if(!safe(x,y)||seen.has(key))continue;const wb=cellToWorld(x,y);
     const blocked=barriers.some(b=>Math.max(wa.x,wb.x)+.38>b.minX&&Math.min(wa.x,wb.x)-.38<b.maxX&&Math.max(wa.z,wb.z)+.38>b.minZ&&Math.min(wa.z,wb.z)-.38<b.maxZ);
     if(!blocked){seen.add(key);q.push({x,y});}
   }}
   for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(safe(x,y))assert(seen.has(cellKey(x,y)),'fence-blocked cell seed '+seed+' at '+x+','+y);
 }
 assert(d[GOAL_CELL.y][GOAL_CELL.x]>=0,'goal unreachable');assert.equal(keys.length,KEY_COUNT);for(const k of keys)assert(d[k.y][k.x]>=0);
} console.log('100 seeded maps: '+total+' safe cells reachable; all keys and goals reachable; '+added+' necessary bridges added.');`,ctx);
