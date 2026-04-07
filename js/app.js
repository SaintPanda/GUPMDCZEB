// ═══════════════════════════════════════════════════════════
//  app.js  —  UI logic, interaction, editor, auth
// ═══════════════════════════════════════════════════════════

import {
  nodes, onNodes, startSync, seedIfEmpty,
  saveNode as fbSave,
  saveNodes as fbSaveMany,
  deleteNodes as fbDeleteMany
} from './firebase.js';

import {
  mainCv,
  cam, dns,
  resize, buildLayout, project,
  drawBg, drawMain,
  nodeAt,
  setHov, setSel
} from './canvas.js';

// ── App state ─────────────────────────────────────────────
const PASS = 'author2024';
let isAuthor = false;
let rootId   = 'root';
let curNode  = null;
let ctxNode  = null;

// Canvas drag state
let drag = false, dmoved = false;
let dsx = 0, dsy = 0, drxSaved = 0, drySaved = 0;
let lcn = null, lct = 0;

// Editor state
let selColor = '#d2d2d0', edMode = null, edTarget = null;
let kwRange  = null, kwText = '', kwNodeId = null, imgDU = '';

// ── Helpers ───────────────────────────────────────────────
function getNode(id)    { return nodes.find(n => n.id === id); }
function getChildren(id){ const n = getNode(id); return n ? n.children.map(c => getNode(c)).filter(Boolean) : []; }
function depthOf(id)    { let d = 0, c = getNode(id); while (c && c.parentId) { d++; c = getNode(c.parentId); } return d; }
function buildPath(id)  { const p = []; let c = getNode(id); while (c) { p.unshift(c.name); c = c.parentId ? getNode(c.parentId) : null; } return p.join(' › '); }

// ═══════════════════════════════════════════════════════════
//  ANIMATION LOOP
// ═══════════════════════════════════════════════════════════
function loop() {
  cam.panelOffsetX += (cam.panelTargetX - cam.panelOffsetX) * 0.08;
  if (!drag) {
    cam.ry = (cam.ry + 0.0028);
    cam.rx = Math.max(-0.7, Math.min(0.7, cam.rx + 0.0007));
  }
  project();
  drawBg();
  drawMain(nodes);
  requestAnimationFrame(loop);
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
async function init() {
  await seedIfEmpty();

  onNodes(() => {
    buildLayout(nodes, rootId);
    if (curNode) {
      const fresh = getNode(curNode.id);
      if (fresh) renderPanel(fresh); else closePanel();
    }
    hideLoading();
  });

  startSync();

  window.addEventListener('resize', () => resize(nodes, rootId));
  resize(nodes, rootId);
  updateBC();
  bindEvents();
  loop();
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (!el) return;
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 600);
}

// ═══════════════════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════════════════
function bindEvents() {
  mainCv.addEventListener('mousemove',   onMouseMove);
  mainCv.addEventListener('mousedown',   onMouseDown);
  mainCv.addEventListener('mouseup',     onMouseUp);
  mainCv.addEventListener('mouseleave',  () => { drag = false; });
  mainCv.addEventListener('contextmenu', onCtxMenu);
  mainCv.addEventListener('wheel', e => {
    e.preventDefault();
    cam.zoomScale = Math.max(0.3, Math.min(3.5, cam.zoomScale * (e.deltaY > 0 ? 0.92 : 1.09)));
  }, { passive: false });

  // Touch
  mainCv.addEventListener('touchstart', e => {
    const t = e.touches[0];
    dsx = t.clientX; dsy = t.clientY;
    drxSaved = cam.rx; drySaved = cam.ry; dmoved = false;
  }, { passive: true });
  mainCv.addEventListener('touchmove', e => {
    const t = e.touches[0]; dmoved = true;
    cam.ry = drySaved + (t.clientX - dsx) * 0.006;
    cam.rx = Math.max(-0.7, Math.min(0.7, drxSaved + (t.clientY - dsy) * 0.004));
    e.preventDefault();
  }, { passive: false });
  mainCv.addEventListener('touchend', e => {
    if (!dmoved) { const t = e.changedTouches[0]; handleClick(t.clientX, t.clientY); }
  });

  // Modals
  document.getElementById('auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') checkAuth(); });
  document.getElementById('auth-overlay').addEventListener('click', e => { if (e.target === document.getElementById('auth-overlay')) document.getElementById('auth-overlay').classList.remove('open'); });
  document.getElementById('editor-overlay').addEventListener('click', e => { if (e.target === document.getElementById('editor-overlay')) closeEditor(); });
  document.addEventListener('click', e => { if (!document.getElementById('ctx-menu').contains(e.target)) closeCtx(); });

  // Image drop
  const da = document.getElementById('img-drop-area');
  da.addEventListener('dragover', e => e.preventDefault());
  da.addEventListener('drop', e => {
    e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => { imgDU = ev.target.result; const p = document.getElementById('img-preview'); p.src = imgDU; p.style.display = 'block'; }; r.readAsDataURL(f);
  });
}

function onMouseMove(e) {
  if (drag) {
    dmoved = true;
    cam.ry = drySaved + (e.clientX - dsx) * 0.006;
    cam.rx = Math.max(-0.7, Math.min(0.7, drxSaved + (e.clientY - dsy) * 0.004));
    return;
  }
  const d = nodeAt(e.clientX, e.clientY);
  setHov(d ? d.node : null);
  const tip = document.getElementById('tooltip');
  if (d) {
    mainCv.style.cursor = 'pointer';
    tip.style.opacity = '1'; tip.textContent = d.node.name;
    tip.style.left = (e.clientX + 15) + 'px'; tip.style.top = (e.clientY - 7) + 'px';
  } else {
    mainCv.style.cursor = 'grab'; tip.style.opacity = '0';
  }
}

function onMouseDown(e) {
  drag = true; dmoved = false;
  dsx = e.clientX; dsy = e.clientY;
  drxSaved = cam.rx; drySaved = cam.ry;
  mainCv.style.cursor = 'grabbing';
}

function onMouseUp(e) {
  drag = false;
  mainCv.style.cursor = nodeAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
  if (!dmoved) handleClick(e.clientX, e.clientY);
  dmoved = false;
}

function onCtxMenu(e) {
  e.preventDefault();
  const d = nodeAt(e.clientX, e.clientY);
  if (d) { ctxNode = d.node; showCtx(e.clientX, e.clientY); }
}

function handleClick(x, y) {
  closeCtx();
  const d = nodeAt(x, y), now = Date.now();
  if (d) {
    if (lcn === d.node.id && now - lct < 380) {
      if (d.node.children && d.node.children.length > 0) drill(d.node.id);
    } else {
      renderPanel(d.node);
    }
    lcn = d.node.id; lct = now;
  } else {
    goUp(); lcn = null;
  }
}

// ═══════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════
function drill(id) { rootId = id; buildLayout(nodes, rootId); updateBC(); closePanel(); }

function goUp() {
  const r = getNode(rootId);
  if (r && r.parentId) { rootId = r.parentId; buildLayout(nodes, rootId); updateBC(); }
  closePanel();
}

function updateBC() {
  const bc = []; let id = rootId;
  while (id) { const n = getNode(id); if (!n) break; bc.unshift(n.name); id = n.parentId; }
  document.getElementById('breadcrumb').textContent = bc.join(' › ');
}

// ═══════════════════════════════════════════════════════════
//  PANEL
// ═══════════════════════════════════════════════════════════
function renderPanel(node) {
  curNode = node; setSel(node);
  document.getElementById('panel-title').textContent = node.name;
  document.getElementById('panel-meta').textContent  = `рівень ${depthOf(node.id)} · ${node.children?.length || 0} дочірніх`;

  const img = document.getElementById('panel-image');
  if (node.image) { img.src = node.image; img.style.display = 'block'; } else img.style.display = 'none';

  let html = node.content || '';
  (node.keywords || []).forEach(kw => {
    const esc = kw.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(esc, 'g'),
      `<span class="kw-link" data-nav="${kw.targetNodeId}" title="→ ${getNode(kw.targetNodeId)?.name || '?'}">${kw.text}</span>`);
  });
  document.getElementById('panel-content').innerHTML = html;
  document.getElementById('panel-content').querySelectorAll('.kw-link[data-nav]').forEach(el => {
    el.addEventListener('click', () => { const n = getNode(el.dataset.nav); if (n) renderPanel(n); });
  });

  const cl = document.getElementById('children-list'); cl.innerHTML = '';
  const ch = getChildren(node.id);
  document.getElementById('panel-children').style.display = ch.length ? 'block' : 'none';
  ch.forEach(c => {
    const s = document.createElement('span'); s.className = 'child-chip'; s.textContent = c.name;
    s.addEventListener('click', () => renderPanel(c)); cl.appendChild(s);
  });

  document.querySelectorAll('.author-only').forEach(el => el.classList.toggle('hidden', !isAuthor));
  document.getElementById('node-panel').classList.add('open');
  cam.panelTargetX = -230;
}

function closePanel() {
  document.getElementById('node-panel').classList.remove('open');
  curNode = null; setSel(null);
  cam.panelTargetX = 0;
}

// ═══════════════════════════════════════════════════════════
//  CONTEXT MENU
// ═══════════════════════════════════════════════════════════
function showCtx(x, y) {
  document.querySelectorAll('.author-only').forEach(el => el.classList.toggle('hidden', !isAuthor));
  const m = document.getElementById('ctx-menu');
  m.style.left = x + 'px'; m.style.top = y + 'px'; m.classList.add('open');
}
function closeCtx() { document.getElementById('ctx-menu').classList.remove('open'); }

window.ctxAction = a => {
  closeCtx(); if (!ctxNode) return;
  if (a === 'open') { renderPanel(ctxNode); return; }
  if (!isAuthor) return;
  openEditor(a === 'add-sibling' ? 'add-sibling' : a === 'add-child' ? 'add-child' : 'edit', ctxNode);
};

// ═══════════════════════════════════════════════════════════
//  PANEL BUTTONS
// ═══════════════════════════════════════════════════════════
window.panelAddChild   = () => { if (curNode) openEditor('add-child',   curNode); };
window.panelAddSibling = () => { if (curNode) openEditor('add-sibling', curNode); };
window.panelEdit       = () => { if (curNode) openEditor('edit',        curNode); };
window.panelDelete     = () => { if (curNode) doDeleteNode(curNode); };
window.closePanel      = closePanel;

// ═══════════════════════════════════════════════════════════
//  EDITOR
// ═══════════════════════════════════════════════════════════
function openEditor(mode, node) {
  if (!isAuthor) return;
  edMode = mode; edTarget = node; imgDU = ''; selColor = '#d2d2d0';
  const ti = { 'add-sibling': '+ сусідня нода', 'add-child': '+ дочірня нода', 'edit': '✎ редагувати' };
  document.getElementById('editor-title').textContent = ti[mode] || 'нода';
  document.getElementById('ed-name').value            = mode === 'edit' ? node.name : '';
  document.getElementById('editor-area').innerHTML    = mode === 'edit' ? (node.content || '') : '';
  const pv = document.getElementById('img-preview');
  pv.src = mode === 'edit' ? (node.image || '') : ''; pv.style.display = (mode === 'edit' && node.image) ? 'block' : 'none';
  if (mode === 'edit') selColor = node.color || '#d2d2d0';
  document.querySelectorAll('.color-dot').forEach(d => { d.style.outline = d.dataset.color === selColor ? '2px solid #555' : 'none'; d.style.outlineOffset = '2px'; });
  document.getElementById('editor-overlay').classList.add('open');
  setTimeout(() => document.getElementById('ed-name').focus(), 100);
}

function closeEditor() { document.getElementById('editor-overlay').classList.remove('open'); }
window.closeEditor = closeEditor;

window.saveNode = async function() {
  const name = document.getElementById('ed-name').value.trim();
  if (!name) { alert('Введіть назву'); return; }
  const saveBtn = document.querySelector('#editor-footer .ed-btn.primary');
  saveBtn.disabled = true; saveBtn.textContent = 'збереження…';
  const el = document.getElementById('editor-area');
  const content = el.innerHTML;
  const image   = imgDU || (edMode === 'edit' ? edTarget.image : '');
  const kws = [];
  el.querySelectorAll('.kw-link[data-target]').forEach(s => kws.push({ text: s.textContent, targetNodeId: s.dataset.target }));
  try {
    if (edMode === 'edit') {
      await fbSave({ ...edTarget, name, content, image, color: selColor, keywords: kws });
    } else {
      const nid  = 'n' + Date.now();
      const pid  = edMode === 'add-child' ? edTarget.id : edTarget.parentId;
      const pNode = getNode(pid);
      await fbSaveMany([
        { id: nid, name, content, image, color: selColor, parentId: pid, children: [], keywords: kws },
        { ...pNode, children: [...(pNode.children || []), nid] }
      ]);
    }
    closeEditor();
  } catch (e) { alert('Помилка: ' + e.message); }
  finally { saveBtn.disabled = false; saveBtn.textContent = 'зберегти'; }
};

async function doDeleteNode(node) {
  if (!node || !isAuthor) return;
  if (!confirm(`Видалити "${node.name}" та всі дочірні?`)) return;
  const toDelete = [];
  function collect(id) { const n = getNode(id); if (!n) return; toDelete.push(id); n.children.forEach(collect); }
  collect(node.id);
  const parent = getNode(node.parentId);
  if (parent) await fbSave({ ...parent, children: parent.children.filter(c => c !== node.id) });
  await fbDeleteMany(toDelete);
  closePanel();
}

// ── Toolbar helpers ───────────────────────────────────────
window.fmt               = (cmd, val) => { document.getElementById('editor-area').focus(); document.execCommand(cmd, false, val || null); };
window.insertLink        = () => { const u = prompt('URL:'); if (u) window.fmt('createLink', u); };
window.insertInlineImage = () => { const u = prompt('URL зображення:'); if (u) { document.getElementById('editor-area').focus(); document.execCommand('insertHTML', false, `<img src="${u}" style="max-width:100%">`); } };
window.handleImageUpload = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { imgDU = ev.target.result; const p = document.getElementById('img-preview'); p.src = imgDU; p.style.display = 'block'; }; r.readAsDataURL(f); };
window.selectColor       = el => { selColor = el.dataset.color; document.querySelectorAll('.color-dot').forEach(d => { d.style.outline = d === el ? '2px solid #555' : 'none'; d.style.outlineOffset = '2px'; }); };

// ═══════════════════════════════════════════════════════════
//  KEYWORD LINKING
// ═══════════════════════════════════════════════════════════
window.openKwLink = () => {
  const s = window.getSelection();
  if (!s || s.rangeCount === 0 || !s.toString().trim()) { alert('Виділіть текст'); return; }
  kwRange = s.getRangeAt(0).cloneRange(); kwText = s.toString().trim(); kwNodeId = null;
  document.getElementById('kw-selected-text').textContent = `"${kwText}"`;
  document.getElementById('kw-search').value = '';
  window.filterKwNodes();
  document.getElementById('kw-overlay').classList.add('open');
};
window.closeKw        = () => document.getElementById('kw-overlay').classList.remove('open');
window.filterKwNodes  = () => {
  const q = document.getElementById('kw-search').value.toLowerCase();
  const list = document.getElementById('kw-list'); list.innerHTML = '';
  nodes.map(n => ({ id: n.id, name: n.name, path: buildPath(n.id) }))
    .filter(n => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
    .slice(0, 20)
    .forEach(n => {
      const d = document.createElement('div');
      d.className = 'kw-option' + (kwNodeId === n.id ? ' selected' : '');
      d.innerHTML = `<span>${n.name}</span><span class="path">${n.path}</span>`;
      d.addEventListener('click', () => { kwNodeId = n.id; document.querySelectorAll('.kw-option').forEach(x => x.classList.remove('selected')); d.classList.add('selected'); });
      list.appendChild(d);
    });
};
window.applyKwLink = () => {
  if (!kwNodeId) { alert('Оберіть вузол'); return; }
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(kwRange);
  document.execCommand('insertHTML', false, `<span class="kw-link" data-target="${kwNodeId}" style="color:#888;border-bottom:1px dashed #bbb;cursor:pointer">${kwText}</span>`);
  window.closeKw();
};

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════
window.openAuth = () => {
  if (isAuthor) {
    isAuthor = false;
    document.getElementById('auth-btn').textContent = 'Автор';
    document.getElementById('auth-btn').classList.remove('active');
    document.querySelectorAll('.author-only').forEach(el => el.classList.add('hidden'));
    return;
  }
  document.getElementById('auth-err').style.display = 'none';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-overlay').classList.add('open');
  setTimeout(() => document.getElementById('auth-pass').focus(), 100);
};
window.checkAuth = () => {
  if (document.getElementById('auth-pass').value === PASS) {
    isAuthor = true;
    document.getElementById('auth-overlay').classList.remove('open');
    document.getElementById('auth-btn').textContent = 'Вийти';
    document.getElementById('auth-btn').classList.add('active');
    document.querySelectorAll('.author-only').forEach(el => el.classList.remove('hidden'));
  } else {
    document.getElementById('auth-err').style.display = 'block';
  }
};

// ── Boot ─────────────────────────────────────────────────
init();