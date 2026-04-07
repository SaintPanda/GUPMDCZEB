// ═══════════════════════════════════════════════════════════
//  canvas.js  —  All rendering: background + 3D neural sphere
// ═══════════════════════════════════════════════════════════

// ── Canvas elements ───────────────────────────────────────
export const bgCv   = document.getElementById('bg-canvas');
export const midCv  = document.getElementById('mid-canvas');
export const mainCv = document.getElementById('canvas');

const bgCtx  = bgCv.getContext('2d');
const midCtx = midCv.getContext('2d');
export const mainCtx = mainCv.getContext('2d');

// ── Mutable camera state (object so mutations are visible) ─
export const cam = {
  rx: 0.22, ry: 0,
  zoomScale: 1.0,
  panelOffsetX: 0,
  panelTargetX: 0,
  pulseT: 0,
  W: 0, H: 0, CX: 0, CY: 0
};

// ── Displayed nodes (3D projected) ────────────────────────
export const dns = [];

// ── Hover / selected ─────────────────────────────────────
export let hovNode = null;
export let selNode = null;
export function setHov(n) { hovNode = n; }
export function setSel(n) { selNode = n; }

// ═══════════════════════════════════════════════════════════
//  RESIZE
// ═══════════════════════════════════════════════════════════
export function resize(nodeList, rootId) {
  cam.W = bgCv.width = midCv.width = mainCv.width = window.innerWidth;
  cam.H = bgCv.height = midCv.height = mainCv.height = window.innerHeight;
  cam.CX = cam.W / 2; cam.CY = cam.H / 2;
  initGhostSystems();
  buildLayout(nodeList, rootId);
}

// ═══════════════════════════════════════════════════════════
//  BACKGROUND — two-layer ghost neural network
// ═══════════════════════════════════════════════════════════
let ghostSystems = [], bgScrollX = 0, bgScrollY = 0;
let midSystems   = [], midScrollX = 0, midScrollY = 0;

function makeGhostSystem(ox, oy, scale) {
  const nc  = 4 + Math.floor(Math.random() * 5);
  const pts = [{ x: 0, y: 0, r: 3.5 * scale, parent: -1 }];
  for (let i = 0; i < nc; i++) {
    const ang  = (i / nc) * Math.PI * 2 + Math.random() * 0.5;
    const dist = (25 + Math.random() * 20) * scale;
    pts.push({ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, r: (1.5 + Math.random()) * scale, parent: 0 });
    if (Math.random() < 0.5) {
      const ang2  = ang + (Math.random() - 0.5) * 0.8;
      const dist2 = dist + (14 + Math.random() * 14) * scale;
      pts.push({ x: Math.cos(ang2) * dist2, y: Math.sin(ang2) * dist2, r: scale * 0.9, parent: pts.length - 1 });
    }
  }
  return { ox, oy, pts, alpha: 0.04 + Math.random() * 0.07 };
}

function initGhostSystems() {
  ghostSystems = [];
  const cols = 18, rows = 12;
  const cw = cam.W * 5 / cols, ch = cam.H * 5 / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      ghostSystems.push(makeGhostSystem(c * cw + Math.random() * cw * 0.7, r * ch + Math.random() * ch * 0.7, 0.3 + Math.random() * 0.55));

  midSystems = [];
  for (let i = 0; i < 24; i++) {
    const gs = makeGhostSystem(Math.random() * cam.W * 3.5, Math.random() * cam.H * 3.5, 0.8 + Math.random() * 0.9);
    gs.alpha = 0.07 + Math.random() * 0.09;
    midSystems.push(gs);
  }
}

function drawLayer(ctx, systems, scrollX, scrollY, fw, fh, ox, oy) {
  systems.forEach(gs => {
    const sx = ((gs.ox - scrollX) % fw + fw) % fw - ox;
    const sy = ((gs.oy - scrollY) % fh + fh) % fh - oy;
    if (sx < -200 || sx > cam.W + 200 || sy < -200 || sy > cam.H + 200) return;
    const a = gs.alpha;
    gs.pts.forEach((pt, i) => {
      if (i === 0) return;
      const par = gs.pts[pt.parent];
      ctx.beginPath(); ctx.moveTo(sx + par.x, sy + par.y); ctx.lineTo(sx + pt.x, sy + pt.y);
      ctx.strokeStyle = `rgba(70,70,70,${a * 0.85})`; ctx.lineWidth = 0.5; ctx.stroke();
    });
    gs.pts.forEach(pt => {
      ctx.beginPath(); ctx.arc(sx + pt.x, sy + pt.y, pt.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(60,60,60,${a * 1.3})`; ctx.fill();
    });
  });
}

export function drawBg() {
  bgCtx.clearRect(0, 0, cam.W, cam.H);
  bgScrollX += 0.12; bgScrollY += 0.05;
  drawLayer(bgCtx, ghostSystems, bgScrollX, bgScrollY, cam.W * 5, cam.H * 5, cam.W, cam.H);

  midCtx.clearRect(0, 0, cam.W, cam.H);
  midScrollX += 0.22; midScrollY += 0.09;
  drawLayer(midCtx, midSystems, midScrollX, midScrollY, cam.W * 3.5, cam.H * 3.5, cam.W * 0.3, cam.H * 0.3);
}

// ═══════════════════════════════════════════════════════════
//  LAYOUT — 3D sphere from node tree
// ═══════════════════════════════════════════════════════════
export function buildLayout(nodeList, rootId) {
  dns.length = 0;
  const getN  = id => nodeList.find(n => n.id === id);
  const getCh = id => { const n = getN(id); return n ? n.children.map(c => getN(c)).filter(Boolean) : []; };

  const root = getN(rootId); if (!root) return;
  const ch = getCh(rootId), N = ch.length;
  const SR = Math.min(cam.W, cam.H) * 0.23;
  const GA = Math.PI * (3 - Math.sqrt(5));

  dns.push({ node: root, x3: 0, y3: 0, z3: 0, depth: 0 });

  ch.forEach((c, i) => {
    const theta = GA * i;
    const phi   = Math.acos(1 - 2 * (i + 0.5) / Math.max(N, 1));
    const x3 = SR * Math.sin(phi) * Math.cos(theta);
    const y3 = SR * Math.sin(phi) * Math.sin(theta);
    const z3 = SR * Math.cos(phi);
    dns.push({ node: c, x3, y3, z3, depth: 1 });

    const sc = getCh(c.id), sr2 = SR * 0.38;
    sc.forEach((s, j) => {
      const sa = GA * j, sp = Math.acos(1 - 2 * (j + 0.5) / Math.max(sc.length, 1));
      dns.push({ node: s, x3: x3 + sr2 * Math.sin(sp) * Math.cos(sa), y3: y3 + sr2 * Math.sin(sp) * Math.sin(sa), z3: z3 + sr2 * Math.cos(sp), depth: 2 });
    });
  });

  project();
}

export function project() {
  const { rx, ry, zoomScale, panelOffsetX, CX, CY } = cam;
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  const FOV  = 780;

  dns.forEach(d => {
    let x  = d.x3 * cosY - d.z3 * sinY;
    let z  = d.x3 * sinY + d.z3 * cosY;
    let y  = d.y3 * cosX - z * sinX;
    let z2 = d.y3 * sinX + z * cosX;
    const sc = FOV / (FOV + z2 + 200);
    d.sx = CX + panelOffsetX + x * sc * zoomScale;
    d.sy = CY + y * sc * zoomScale;
    d.sz = z2; d.scale = sc;
    const br = d.depth === 0 ? 44 : d.depth === 1 ? 22 : 10;
    d.sr = br * sc * 1.1 * zoomScale;
  });
  dns.sort((a, b) => a.sz - b.sz);
}

// ═══════════════════════════════════════════════════════════
//  MAIN DRAW
// ═══════════════════════════════════════════════════════════
export function drawMain(nodeList) {
  mainCtx.clearRect(0, 0, cam.W, cam.H);
  cam.pulseT += 0.008;
  drawKwArcs(nodeList);
  drawAxons();
  dns.forEach(d => drawNeuron(d));
}

function drawAxons() {
  dns.forEach(d => {
    if (d.depth === 0) return;
    const par = dns.find(p => p.node.id === d.node.parentId);
    if (!par) return;
    const ih = hovNode && (d.node.id === hovNode.id || par.node.id === hovNode.id);
    const lw = d.depth === 1 ? 1.6 : 0.9;

    if (ih) {
      mainCtx.beginPath(); mainCtx.moveTo(par.sx, par.sy); mainCtx.lineTo(d.sx, d.sy);
      mainCtx.strokeStyle = 'rgba(80,80,80,0.12)'; mainCtx.lineWidth = lw + 5; mainCtx.lineCap = 'round'; mainCtx.stroke();
    }
    mainCtx.beginPath(); mainCtx.moveTo(par.sx, par.sy); mainCtx.lineTo(d.sx, d.sy);
    mainCtx.strokeStyle = ih ? (d.depth === 1 ? 'rgba(40,40,40,0.75)' : 'rgba(60,60,60,0.6)') : (d.depth === 1 ? 'rgba(80,80,80,0.45)' : 'rgba(120,120,120,0.28)');
    mainCtx.lineWidth = lw; mainCtx.lineCap = 'round'; mainCtx.stroke();

    const speed = d.depth === 1 ? 0.18 : 0.12;
    const phase = (d.node.id.charCodeAt(0) * 17 + d.depth * 7) % 100 / 100;
    const dx = d.sx - par.sx, dy = d.sy - par.sy;
    [0, 0.5].forEach(offset => {
      const tt = (cam.pulseT * speed + phase + offset) % 1;
      const pr = offset === 0 ? (d.depth === 1 ? 2.2 : 1.4) : (d.depth === 1 ? 1.3 : 0.8);
      mainCtx.beginPath();
      mainCtx.arc(par.sx + dx * tt, par.sy + dy * tt, pr, 0, Math.PI * 2);
      mainCtx.fillStyle = `rgba(50,50,50,${(ih ? 0.9 : 0.55) * (offset === 0 ? 1 : 0.5)})`;
      mainCtx.fill();
    });
  });
}

function drawNeuron(d) {
  const { sx, sy, sr, node, depth, scale } = d;
  const ih   = hovNode && hovNode.id === node.id;
  const isel = selNode && selNode.id === node.id;

  if (depth < 2 || ih) {
    const gr = mainCtx.createRadialGradient(sx, sy, sr * 0.7, sx, sy, sr + (depth === 0 ? 14 : 8));
    gr.addColorStop(0, `rgba(80,80,80,${depth === 0 ? 0.12 : 0.07})`); gr.addColorStop(1, 'rgba(80,80,80,0)');
    mainCtx.beginPath(); mainCtx.arc(sx, sy, sr + (depth === 0 ? 14 : 8), 0, Math.PI * 2);
    mainCtx.fillStyle = gr; mainCtx.fill();
  }
  mainCtx.beginPath(); mainCtx.arc(sx + 1.5 * scale, sy + 2 * scale, sr, 0, Math.PI * 2);
  mainCtx.fillStyle = `rgba(0,0,0,${0.08 * scale})`; mainCtx.fill();

  const col = node.color || '#d0d0ce';
  const g = mainCtx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
  g.addColorStop(0, adjCol(col, 28)); g.addColorStop(0.45, col); g.addColorStop(1, adjCol(col, -18));
  mainCtx.beginPath(); mainCtx.arc(sx, sy, sr, 0, Math.PI * 2);
  mainCtx.fillStyle = g; mainCtx.fill();

  mainCtx.strokeStyle = ih ? 'rgba(20,20,20,0.7)' : (isel ? 'rgba(40,40,40,0.55)' : `rgba(100,100,100,${depth === 0 ? 0.5 : depth === 1 ? 0.35 : 0.22})`);
  mainCtx.lineWidth = depth === 0 ? 1.8 : depth === 1 ? 1.2 : 0.7; mainCtx.stroke();

  if (depth === 1 && !ih) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mainCtx.beginPath();
      mainCtx.moveTo(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr);
      mainCtx.lineTo(sx + Math.cos(a) * (sr + 4 * scale), sy + Math.sin(a) * (sr + 4 * scale));
      mainCtx.strokeStyle = 'rgba(100,100,100,0.25)'; mainCtx.lineWidth = 0.5; mainCtx.stroke();
    }
  }
  if (depth === 0) {
    mainCtx.beginPath(); mainCtx.arc(sx, sy, sr * 0.42, 0, Math.PI * 2);
    mainCtx.strokeStyle = 'rgba(80,80,80,0.2)'; mainCtx.lineWidth = 1; mainCtx.stroke();
    mainCtx.beginPath(); mainCtx.arc(sx, sy, sr * 0.12, 0, Math.PI * 2);
    mainCtx.fillStyle = 'rgba(60,60,60,0.35)'; mainCtx.fill();
  }
  mainCtx.beginPath(); mainCtx.arc(sx - sr * 0.28, sy - sr * 0.28, sr * (depth === 0 ? 0.3 : 0.25), 0, Math.PI * 2);
  mainCtx.fillStyle = 'rgba(255,255,255,0.42)'; mainCtx.fill();

  const cc = node.children?.length || 0;
  if (cc > 0 && sr > 10) {
    const bx = sx + sr * 0.62, by = sy - sr * 0.62, br2 = 5.5 * scale;
    mainCtx.beginPath(); mainCtx.arc(bx, by, br2, 0, Math.PI * 2);
    mainCtx.fillStyle = 'rgba(50,50,50,0.7)'; mainCtx.fill();
    mainCtx.fillStyle = '#f0efed'; mainCtx.font = `bold ${7 * scale}px JetBrains Mono`;
    mainCtx.textAlign = 'center'; mainCtx.textBaseline = 'middle'; mainCtx.fillText(cc, bx, by);
  }
  if (isel) {
    const pr = sr + 6 + Math.sin(cam.pulseT * 3) * 3;
    mainCtx.beginPath(); mainCtx.arc(sx, sy, pr, 0, Math.PI * 2);
    mainCtx.strokeStyle = `rgba(50,50,50,${0.25 + Math.sin(cam.pulseT * 3) * 0.12})`;
    mainCtx.lineWidth = 1; mainCtx.setLineDash([3, 4]); mainCtx.stroke(); mainCtx.setLineDash([]);
  }
  if (sr > 7) {
    const fs = Math.max(8, Math.min(depth === 0 ? 14 : 12, sr * 0.54));
    mainCtx.fillStyle = ih ? '#111' : (depth === 0 ? 'rgba(30,30,30,0.9)' : `rgba(35,35,35,${depth === 1 ? 0.82 : 0.7})`);
    mainCtx.font = `${depth === 0 ? '400' : '300'} ${fs}px Cormorant Garamond`;
    mainCtx.textAlign = 'center'; mainCtx.textBaseline = 'middle';
    wrapText(node.name, sx, sy, sr * 1.55, fs + 2.5);
  }
}

function drawKwArcs(nodeList) {
  nodeList.forEach(n => {
    if (!n.keywords) return;
    n.keywords.forEach(kw => {
      const a = dns.find(d => d.node.id === n.id), b = dns.find(d => d.node.id === kw.targetNodeId);
      if (!a || !b) return;
      mainCtx.beginPath(); mainCtx.moveTo(a.sx, a.sy);
      mainCtx.quadraticCurveTo((a.sx + b.sx) / 2, (a.sy + b.sy) / 2 - 44, b.sx, b.sy);
      mainCtx.setLineDash([3, 7]); mainCtx.strokeStyle = 'rgba(100,100,100,0.28)'; mainCtx.lineWidth = 0.8; mainCtx.stroke(); mainCtx.setLineDash([]);
      mainCtx.fillStyle = 'rgba(130,130,130,0.5)'; mainCtx.font = '7px JetBrains Mono'; mainCtx.textAlign = 'center';
      mainCtx.fillText(kw.text.substring(0, 18), (a.sx + b.sx) / 2, (a.sy + b.sy) / 2 - 6);
    });
  });
}

function adjCol(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.max(0,Math.min(255,r+amt))},${Math.max(0,Math.min(255,g+amt))},${Math.max(0,Math.min(255,b+amt))})`;
}
function wrapText(text, x, y, mw, lh) {
  const ws = text.split(' '); let ls = [], l = '';
  ws.forEach(w => { const t = l + w + ' '; if (mainCtx.measureText(t).width > mw && l) { ls.push(l.trim()); l = w + ' '; } else l = t; });
  if (l) ls.push(l.trim());
  const th = ls.length * lh;
  ls.forEach((s, i) => mainCtx.fillText(s, x, y - th / 2 + i * lh + lh / 2));
}

export function nodeAt(x, y) {
  for (let i = dns.length - 1; i >= 0; i--) {
    const d = dns[i];
    if (Math.hypot(d.sx - x, d.sy - y) <= d.sr) return d;
  }
  return null;
}

