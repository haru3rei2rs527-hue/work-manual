const {
  MAX_PHOTOS,
  MAX_STEPS,
  PHOTO_NUM,
  STEP_NUM,
  EDIT_STREAM,
  normalizePhotoEntry: normalizePhotoEntryFromLayout,
  defaultStreamActive: defaultStreamActiveFromLayout
} = WM_LAYOUT;
const REF_HINT = '例）②番写真を参照し、○○の位置に合わせる';
const DRAFT_KEY = 'work-manual-draft-v5';

let state = {
  baseName: '',
  _previousBaseName: '',
  header: { title: '', partNo: '', version: '', date: '', author: '' },
  photoLabels: { '1': '①', '2': '②', '3': '③', '4': '④' },
  stepLabels: Object.fromEntries(STEP_NUM.map((n, i) => [String(i), n])),
  photos: { '1': null, '2': null, '3': null, '4': null },
  steps: Array.from({ length: MAX_STEPS }, () => ({ title: '', body: '' })),
  footer: '',
  streamActive: null
};

function defaultStreamActive() {
  return defaultStreamActiveFromLayout();
}

function getStreamActive() {
  if (!state.streamActive) state.streamActive = defaultStreamActive();
  return state.streamActive;
}

function isStreamBlockActive(block) {
  const a = getStreamActive();
  if (block.type === 'photo') return !!a.photos[String(block.slot)];
  return !!a.steps[String(block.idx)];
}

let activePhotoSlot = null;
let refPhotos = [];
let photoDrag = null;

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  document.getElementById('fldDate').value =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  buildEditStream();
  initEditStreamDelegation();
  initPreviewPhotoDelegation();
  bindToolbar();
  bindStreamActions();
  bindRefPanel();
  loadDraft();
  document.getElementById('btnRefRefresh').addEventListener('click', loadRefPhotos);
  document.getElementById('refFolderPath').textContent =
    '写真をドロップまたはクリックして追加';
  loadRefPhotos();

  const openInput = document.getElementById('openFileInput');
  if (openInput) {
    openInput.addEventListener('change', () => {
      if (openInput.files[0]) loadSavedFromFile(openInput.files[0]);
      openInput.value = '';
    });
  }

  ['fldTitle', 'fldDate', 'fldAuthor', 'fldFooter'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      syncFromForm();
      renderPreview();
      saveDraft();
    });
  });

  setInterval(saveDraft, 30000);

  document.addEventListener('mousemove', onPhotoDragMove);
  document.addEventListener('mouseup', endPhotoDrag);
  window.addEventListener('resize', () => fitPreviewScale());
});

function defaultState() {
  return {
    baseName: '',
    _previousBaseName: '',
    header: { title: '', partNo: '', version: '', date: '', author: '' },
    photoLabels: { '1': '①', '2': '②', '3': '③', '4': '④' },
    stepLabels: Object.fromEntries(STEP_NUM.map((n, i) => [String(i), n])),
    photos: { '1': null, '2': null, '3': null, '4': null },
    steps: Array.from({ length: MAX_STEPS }, () => ({ title: '', body: '' })),
    footer: '',
    streamActive: defaultStreamActive()
  };
}

function migrateStreamActive(d) {
  if (d.streamActive?.photos && d.streamActive?.steps) {
    return d.streamActive;
  }
  const active = defaultStreamActive();
  if (d.streamVisible) {
    EDIT_STREAM.slice(0, d.streamVisible).forEach(block => {
      if (block.type === 'photo') active.photos[String(block.slot)] = true;
      else active.steps[String(block.idx)] = true;
    });
  }
  for (let s = 1; s <= 4; s++) {
    if (normalizePhotoEntry(d.photos?.[String(s)])) active.photos[String(s)] = true;
  }
  for (let i = 0; i < MAX_STEPS; i++) {
    if (d.steps?.[i]?.title?.trim() || d.steps?.[i]?.body?.trim()) {
      active.steps[String(i)] = true;
    }
  }
  if (!Object.values(active.photos).some(Boolean)) active.photos['1'] = true;
  return active;
}

function syncStreamActiveFromData() {
  const active = getStreamActive();
  for (let s = 1; s <= 4; s++) {
    if (normalizePhotoEntry(state.photos[String(s)])) active.photos[String(s)] = true;
  }
  for (let i = 0; i < MAX_STEPS; i++) {
    if (state.steps[i]?.title?.trim() || state.steps[i]?.body?.trim()) {
      active.steps[String(i)] = true;
    }
  }
}

function revealNextPhoto() {
  const active = getStreamActive();
  for (let s = 1; s <= MAX_PHOTOS; s++) {
    if (!active.photos[String(s)]) {
      active.photos[String(s)] = true;
      buildEditStream();
      saveDraft();
      return;
    }
  }
  toast(`写真はこれ以上追加できません（最大${MAX_PHOTOS}枚）`);
}

function revealNextStep() {
  const active = getStreamActive();
  for (let i = 0; i < MAX_STEPS; i++) {
    if (!active.steps[String(i)]) {
      active.steps[String(i)] = true;
      buildEditStream();
      saveDraft();
      return;
    }
  }
  toast(`コメントはこれ以上追加できません（最大${MAX_STEPS}件）`);
}

function normalizePhotoEntry(raw) {
  return normalizePhotoEntryFromLayout(raw);
}

function getPhotoLabel(slot) {
  return state.photoLabels[String(slot)] || PHOTO_NUM[slot - 1];
}

function getStepLabel(i) {
  return state.stepLabels[String(i)] || STEP_NUM[i];
}

function photoTransformStyle(entry) {
  if (!entry) return '';
  return `--wm-px:${entry.x}px;--wm-py:${entry.y}px;--wm-scale:${entry.scale}`;
}

function migrateState(d) {
  if (!d.photoLabels) {
    d.photoLabels = Object.fromEntries([1, 2, 3, 4].map(n => [String(n), PHOTO_NUM[n - 1]]));
  }
  if (!d.stepLabels) {
    d.stepLabels = {};
  }
  for (let i = 0; i < MAX_STEPS; i++) {
    if (!d.stepLabels[String(i)]) d.stepLabels[String(i)] = STEP_NUM[i];
  }
  if (!d.photos) {
    d.photos = { '1': null, '2': null, '3': null, '4': null };
  }
  for (const k of ['1', '2', '3', '4']) {
    d.photos[k] = normalizePhotoEntry(d.photos[k]);
  }
  const steps = Array.isArray(d.steps) ? d.steps : [];
  d.steps = Array.from({ length: MAX_STEPS }, (_, i) => ({
    title: steps[i]?.title || '',
    body: steps[i]?.body || ''
  }));
  d.streamActive = migrateStreamActive(d);
  const sa = d.streamActive;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (sa.steps[String(i)] === undefined) sa.steps[String(i)] = false;
  }
  delete d.streamVisible;
  return d;
}

function stepRefOptionsHtml() {
  return [1, 2, 3, 4].map(n => {
    const label = getPhotoLabel(n);
    return `<option value="${escapeAttr(label)}">${escapeHtml(label)}番写真</option>`;
  }).join('');
}

function photoBlockHtml(slot) {
  return `
    <div class="wm-stream-block wm-stream-block-photo">
      <div class="wm-stream-block-head">
        <span>写真</span>
        <input type="text" class="wm-num-input photo-num photo-num--stream" data-slot="${slot}" maxlength="4" value="${escapeAttr(getPhotoLabel(slot))}" title="番号">
        <button type="button" class="wm-clear-photo" data-slot="${slot}" title="写真を外す">×</button>
      </div>
      <div class="wm-photo-slot" data-slot="${slot}" tabindex="0">
        <div class="wm-slot-placeholder">クリックで選択 / ドロップ</div>
      </div>
    </div>`;
}

function stepBlockHtml(i) {
  return `
    <div class="wm-stream-block wm-stream-block-step">
      <div class="wm-stream-block-head">
        <span>コメント</span>
        <input type="text" class="wm-num-input step-num step-num--stream" data-idx="${i}" maxlength="4" value="${escapeAttr(getStepLabel(i))}" title="番号">
        <button type="button" class="wm-clear-step" data-idx="${i}" title="このコメントを削除">×</button>
      </div>
      <div class="wm-step-edit" data-step="${i}">
        <div class="wm-step-head">
          <input type="text" class="step-title" placeholder="工程名（短く）" data-idx="${i}">
          <select class="step-ref" data-idx="${i}" title="参照写真">
            <option value="">参照挿入</option>
            ${stepRefOptionsHtml()}
          </select>
        </div>
        <textarea class="step-body" data-idx="${i}" placeholder="${REF_HINT}"></textarea>
      </div>
    </div>`;
}

function removePhotoBlock(slot) {
  const n = String(slot);
  state.photos[n] = null;
  getStreamActive().photos[n] = false;
  const anyPhoto = Object.values(getStreamActive().photos).some(Boolean);
  if (!anyPhoto) getStreamActive().photos['1'] = true;
  buildEditStream();
  saveDraft();
}

function removeStepBlock(stepIdx) {
  state.steps[stepIdx] = { title: '', body: '' };
  getStreamActive().steps[String(stepIdx)] = false;
  buildEditStream();
  saveDraft();
}

function initEditStreamDelegation() {
  const stream = document.getElementById('editStream');
  if (!stream || stream.dataset.delegation) return;
  stream.dataset.delegation = '1';

  stream.addEventListener('click', e => {
    const clearPhoto = e.target.closest('.wm-clear-photo');
    if (clearPhoto?.dataset.slot) {
      e.preventDefault();
      e.stopPropagation();
      removePhotoBlock(clearPhoto.dataset.slot);
      return;
    }
    const clearStep = e.target.closest('.wm-clear-step');
    if (clearStep?.dataset.idx != null) {
      e.preventDefault();
      e.stopPropagation();
      removeStepBlock(parseInt(clearStep.dataset.idx, 10));
      return;
    }
    const slot = e.target.closest('.wm-photo-slot');
    if (slot && !e.target.closest('.photo-num, .wm-slot-thumb')) {
      openPicker(parseInt(slot.dataset.slot, 10));
    }
  });

  stream.addEventListener('input', e => {
    const numPhoto = e.target.closest('.photo-num');
    if (numPhoto?.dataset.slot) {
      const n = numPhoto.dataset.slot;
      state.photoLabels[n] = numPhoto.value || PHOTO_NUM[n - 1];
      updateStepRefSelects();
      renderPreview();
      saveDraft();
      return;
    }
    const numStep = e.target.closest('.step-num');
    if (numStep?.dataset.idx != null) {
      state.stepLabels[numStep.dataset.idx] = numStep.value || STEP_NUM[numStep.dataset.idx];
      renderPreview();
      saveDraft();
      return;
    }
    if (e.target.closest('.step-title, .step-body')) {
      syncStepsFromDom();
      renderPreview();
      saveDraft();
    }
  });

  stream.addEventListener('change', e => {
    const sel = e.target.closest('.step-ref');
    if (!sel || sel.dataset.idx == null) return;
    const idx = parseInt(sel.dataset.idx, 10);
    const v = sel.value;
    if (!v) return;
    const ta = stream.querySelector(`.step-body[data-idx="${idx}"]`);
    const insert = `${v}番写真参照：`;
    if (ta && !ta.value.includes(insert)) {
      ta.value = ta.value ? `${insert}\n${ta.value}` : `${insert}\n`;
    }
    sel.value = '';
    syncStepsFromDom();
    renderPreview();
    saveDraft();
  });

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
    stream.addEventListener(ev, e => {
      const slot = e.target.closest('.wm-photo-slot');
      if (!slot) return;
      if (ev === 'dragenter' || ev === 'dragover') {
        e.preventDefault();
        slot.classList.add('wm-drag-over');
      } else if (ev === 'dragleave') {
        slot.classList.remove('wm-drag-over');
      } else if (ev === 'drop') {
        e.preventDefault();
        slot.classList.remove('wm-drag-over');
        const n = slot.dataset.slot;
        const name = e.dataTransfer.getData('text/ref-photo');
        const files = e.dataTransfer.files;
        if (name) setPhotoByName(n, name);
        else if (files.length) assignFileToSlot(n, files[0]);
      }
    });
  });
}

function buildEditStream() {
  const el = document.getElementById('editStream');
  if (!el) return;
  const blocks = EDIT_STREAM.filter(isStreamBlockActive);
  if (!blocks.length) getStreamActive().photos['1'] = true;
  el.innerHTML = (blocks.length ? blocks : [{ type: 'photo', slot: 1 }]).map(block => {
    if (block.type === 'photo') return photoBlockHtml(block.slot);
    return stepBlockHtml(block.idx);
  }).join('');

  applyStepsToDom();
  renderEditStreamPhotos();
  updateStreamActionButtons();
  renderPreview();
}

function bindStreamActions() {
  document.getElementById('btnAddPhoto')?.addEventListener('click', revealNextPhoto);
  document.getElementById('btnAddStep')?.addEventListener('click', revealNextStep);
}

function updateStreamActionButtons() {
  const active = getStreamActive();
  const canPhoto = [1, 2, 3, 4].some(s => !active.photos[String(s)]);
  const canStep = Array.from({ length: MAX_STEPS }, (_, i) => i).some(
    i => !active.steps[String(i)]
  );
  const btnP = document.getElementById('btnAddPhoto');
  const btnS = document.getElementById('btnAddStep');
  if (btnP) btnP.disabled = !canPhoto;
  if (btnS) btnS.disabled = !canStep;
}

function renderEditStreamPhotos() {
  document.querySelectorAll('#editStream .wm-photo-slot').forEach(slot => {
    const n = slot.dataset.slot;
    const entry = normalizePhotoEntry(state.photos[n]);
    const block = slot.closest('.wm-stream-block-photo');
    let thumb = slot.querySelector('.wm-slot-thumb');
    let ph = slot.querySelector('.wm-slot-placeholder');

    if (entry?.file) {
      slot.classList.add('has-photo');
      if (block) block.classList.add('has-photo');
      if (!thumb) {
        thumb = document.createElement('img');
        thumb.className = 'wm-slot-thumb';
        slot.appendChild(thumb);
      }
      thumb.src = photoUrl(entry.file);
      thumb.alt = `写真${getPhotoLabel(n)}`;
      if (ph) ph.style.display = 'none';
    } else {
      slot.classList.remove('has-photo');
      if (block) block.classList.remove('has-photo');
      if (thumb) thumb.remove();
      if (!ph) {
        ph = document.createElement('div');
        ph.className = 'wm-slot-placeholder';
        ph.innerHTML = 'クリックで選択 / ドロップ';
        slot.appendChild(ph);
      }
      ph.style.display = '';
    }
  });
}

function bindToolbar() {
  document.getElementById('btnNew').addEventListener('click', () => {
    if (!confirm('入力内容を破棄して新規作成しますか？')) return;
    state = defaultState();
    applyToForm();
    buildEditStream();
    saveDraft();
    toast('新規作成しました');
  });
  document.getElementById('btnSave').addEventListener('click', saveManual);
  document.getElementById('btnPdf').addEventListener('click', exportPdf);
  document.getElementById('btnPreview').addEventListener('click', exportPdf);
  document.getElementById('btnOpen').addEventListener('click', openSavedList);
  document.getElementById('pickerCancel').addEventListener('click', () => closePicker());
  document.getElementById('pickerModal').addEventListener('click', e => {
    if (e.target.id === 'pickerModal') closePicker();
  });
}

function bindRefPanel() {
  const drop = document.getElementById('refDropZone');
  const input = document.getElementById('refFileInput');

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    uploadFiles(input.files);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach(ev => {
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('wm-drag-over'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    drop.addEventListener(ev, e => {
      e.preventDefault();
      if (ev === 'drop') uploadFiles(e.dataTransfer.files);
      drop.classList.remove('wm-drag-over');
    });
  });
}

// --- データ同期 ---
function syncFromForm() {
  state.header.title = document.getElementById('fldTitle').value.trim();
  state.header.date = formatDateDisplay(document.getElementById('fldDate').value);
  state.header.author = document.getElementById('fldAuthor').value.trim();
  state.footer = document.getElementById('fldFooter').value;
  if (state.header.title) state.baseName = state.header.title;
}

function syncStepsFromDom() {
  document.querySelectorAll('.wm-step-edit').forEach(el => {
    const i = parseInt(el.dataset.step, 10);
    if (Number.isNaN(i)) return;
    state.steps[i] = {
      title: el.querySelector('.step-title')?.value || '',
      body: el.querySelector('.step-body')?.value || ''
    };
  });
}

function applyToForm() {
  document.getElementById('fldTitle').value = state.header.title || '';
  document.getElementById('fldAuthor').value = state.header.author || '';
  document.getElementById('fldFooter').value = state.footer || '';
  if (state.header.date) {
    const m = state.header.date.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
    if (m) {
      document.getElementById('fldDate').value =
        `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
  }
}

function applyStepsToDom() {
  document.querySelectorAll('.wm-step-edit').forEach(el => {
    const i = parseInt(el.dataset.step, 10);
    if (Number.isNaN(i)) return;
    const block = el.closest('.wm-stream-block');
    const numInp = block?.querySelector('.step-num');
    if (numInp) numInp.value = getStepLabel(i);
    el.querySelector('.step-title').value = state.steps[i]?.title || '';
    el.querySelector('.step-body').value = state.steps[i]?.body || '';
  });
}

function formatDateDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
}

function collectData() {
  syncFromForm();
  syncStepsFromDom();
  return {
    baseName: state.baseName || state.header.title || 'manual',
    _previousBaseName: state._previousBaseName || state.baseName,
    header: { ...state.header },
    photoLabels: { ...state.photoLabels },
    stepLabels: { ...state.stepLabels },
    photos: JSON.parse(JSON.stringify(state.photos)),
    steps: state.steps.map(s => ({ ...s })),
    footer: state.footer,
    streamActive: JSON.parse(JSON.stringify(getStreamActive()))
  };
}

function updateStepRefSelects() {
  document.querySelectorAll('.step-ref').forEach(sel => {
    const v = sel.value;
    sel.innerHTML = `<option value="">参照挿入</option>${stepRefOptionsHtml()}`;
    sel.value = v;
  });
}

// --- 写真 ---
// data URL はそのまま返す。refPhotos 内の名前は URL に解決する。
function photoUrl(filename) {
  if (!filename) return '';
  if (filename.startsWith('data:')) return filename;
  const ref = refPhotos.find(p => p.name === filename);
  if (ref?.url) return ref.url;
  return '';
}

function absolutePhotoUrl(filename) {
  const u = photoUrl(filename);
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('http')) return u;
  return `${location.origin}${u}`;
}

// 写真をスロットにセット（名前 → data URL を解決して保存）
function setPhotoByName(slot, name) {
  if (!name) {
    state.photos[String(slot)] = null;
    buildEditStream();
    saveDraft();
    return;
  }
  // data URL をそのまま state に保存
  const url = photoUrl(name);
  state.photos[String(slot)] = { file: url || name, x: 0, y: 0, scale: 1 };
  getStreamActive().photos[String(slot)] = true;
  buildEditStream();
  saveDraft();
}

// ファイルを直接スロットへ割り当て
async function assignFileToSlot(slot, file) {
  if (!file.type.startsWith('image/')) return;
  const url = await fileToDataUrl(file);
  const existing = refPhotos.findIndex(p => p.name === file.name);
  if (existing >= 0) refPhotos[existing] = { name: file.name, url };
  else refPhotos.push({ name: file.name, url });
  renderRefGrid();
  state.photos[String(slot)] = { file: url, x: 0, y: 0, scale: 1 };
  getStreamActive().photos[String(slot)] = true;
  buildEditStream();
  saveDraft();
}

function applyPhotoTransform(cellEl, entry) {
  const img = cellEl?.querySelector('.wm-photo-frame img');
  if (!img || !entry) return;
  img.style.setProperty('--wm-px', `${entry.x}px`);
  img.style.setProperty('--wm-py', `${entry.y}px`);
  img.style.setProperty('--wm-scale', String(entry.scale));
}

function previewPhotoCell(slot) {
  return document.querySelector(`#previewArea .wm-photo-cell[data-slot="${slot}"]`);
}

function initPreviewPhotoDelegation() {
  const area = document.getElementById('previewArea');
  if (!area || area.dataset.photoDelegated) return;
  area.dataset.photoDelegated = '1';

  area.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const handle = e.target.closest('.wm-photo-resize');
    const img = handle ? null : e.target.closest('.wm-photo-frame img');
    if (!handle && !img) return;

    const cell = (handle || img).closest('.wm-photo-cell[data-slot]');
    if (!cell) return;
    const slot = cell.dataset.slot;
    const entry = normalizePhotoEntry(state.photos[slot]);
    if (!entry) return;

    e.stopPropagation();
    e.preventDefault();

    if (handle) {
      photoDrag = { mode: 'scale', slot, startY: e.clientY, oScale: entry.scale };
    } else {
      photoDrag = {
        mode: 'pan',
        slot,
        startX: e.clientX,
        startY: e.clientY,
        ox: entry.x,
        oy: entry.y
      };
      img.classList.add('wm-dragging');
    }
  });
}

function onPhotoDragMove(e) {
  if (!photoDrag) return;
  const entry = normalizePhotoEntry(state.photos[photoDrag.slot]);
  if (!entry) return;
  if (photoDrag.mode === 'pan') {
    entry.x = photoDrag.ox + (e.clientX - photoDrag.startX);
    entry.y = photoDrag.oy + (e.clientY - photoDrag.startY);
  } else {
    const dy = photoDrag.startY - e.clientY;
    entry.scale = Math.min(5, Math.max(0.15, photoDrag.oScale + dy * 0.012));
  }
  state.photos[photoDrag.slot] = entry;
  const cell = previewPhotoCell(photoDrag.slot);
  if (cell) applyPhotoTransform(cell, entry);
}

function endPhotoDrag() {
  if (!photoDrag) return;
  document.querySelectorAll('.wm-photo-frame img.wm-dragging').forEach(i => i.classList.remove('wm-dragging'));
  photoDrag = null;
  saveDraft();
}

function fitPreviewScale() {
  const wrap = document.querySelector('.wm-preview-wrap');
  const sheet = document.querySelector('#previewArea .wm-sheet');
  if (!wrap || !sheet) return;
  sheet.style.setProperty('--preview-scale', '1');
  wrap.style.height = '';
  const naturalW = sheet.offsetWidth;
  const naturalH = sheet.offsetHeight;
  const avail = wrap.clientWidth - 8;
  if (naturalW > 0 && avail > 0) {
    const scale = Math.min(1, avail / naturalW);
    const rounded = Math.round(scale * 1000) / 1000;
    sheet.style.setProperty('--preview-scale', String(rounded));
    if (rounded < 1) {
      wrap.style.height = `${Math.ceil(naturalH * rounded) + 12}px`;
    }
  }
}

// --- 参考写真パネル ---
function loadRefPhotos() {
  renderRefGrid();
}

function renderRefGrid() {
  const grid = document.getElementById('refGrid');
  if (!refPhotos.length) {
    grid.innerHTML = '<p style="font-size:12px;color:#999;grid-column:1/-1">写真をドロップまたはクリックして追加してください。<br>追加した写真は左の写真枠へドラッグできます。</p>';
    return;
  }
  grid.innerHTML = refPhotos.map(p => `
    <div class="wm-ref-item" draggable="true" data-name="${escapeAttr(p.name)}" title="${escapeAttr(p.name)}">
      <img src="${p.url}" alt="">
      <span>${escapeHtml(p.name)}</span>
    </div>
  `).join('');

  grid.querySelectorAll('.wm-ref-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/ref-photo', item.dataset.name);
      e.dataTransfer.effectAllowed = 'copy';
    });
    item.addEventListener('click', () => {
      if (activePhotoSlot) setPhotoByName(activePhotoSlot, item.dataset.name);
      else toast('先に左の写真マスをクリックしてください');
    });
  });
}

// ローカルファイルをアップロード（サーバー不要・メモリ保持）
async function uploadFiles(fileList) {
  let added = 0;
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) continue;
    const url = await fileToDataUrl(file);
    const existing = refPhotos.findIndex(p => p.name === file.name);
    if (existing >= 0) refPhotos[existing] = { name: file.name, url };
    else refPhotos.push({ name: file.name, url });
    added++;
  }
  if (added) {
    renderRefGrid();
    toast(`${added}枚追加しました`);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// --- プレビュー ---
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function textToHtml(s) {
  return escapeHtml(s).replace(/\n/g, '<br>');
}

function buildSheetHtml(editorMode = false) {
  syncFromForm();
  syncStepsFromDom();
  return WM_LAYOUT.buildSheet({
    data: state,
    editorMode,
    escapeHtml,
    textToHtml,
    escapeAttr,
    photoSrc: (file) => absolutePhotoUrl(file)
  });
}

function renderPreview() {
  document.getElementById('previewArea').innerHTML = buildSheetHtml(true);
  requestAnimationFrame(fitPreviewScale);
}

// --- ピッカー ---
function openPicker(slot) {
  activePhotoSlot = slot;
  document.getElementById('pickerTitle').textContent = `写真${getPhotoLabel(slot)} を選択`;
  const list = document.getElementById('pickerList');

  if (!refPhotos.length) {
    list.innerHTML = `
      <div style="text-align:center;padding:20px">
        <p style="color:#666;margin-bottom:12px">右パネルに写真を追加するか、<br>直接ここへドロップしてください。</p>
        <button type="button" class="wm-btn wm-btn-secondary" id="pickerFileBtn">ファイルを選択</button>
      </div>`;
    document.getElementById('pickerFileBtn')?.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.multiple = true;
      inp.onchange = async () => {
        await uploadFiles(inp.files);
        openPicker(slot);
      };
      inp.click();
    });
  } else {
    list.innerHTML = refPhotos.map(p => `
      <button type="button" data-name="${escapeAttr(p.name)}">
        <img src="${p.url}" alt="">
      </button>
    `).join('');
    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        setPhotoByName(slot, btn.dataset.name);
        closePicker();
      });
    });
  }

  // ピッカー内ドロップ対応
  list.addEventListener('dragover', e => e.preventDefault());
  list.addEventListener('drop', async e => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      await uploadFiles(e.dataTransfer.files);
      openPicker(slot);
    }
  });

  document.getElementById('pickerModal').classList.add('open');
}

function closePicker() {
  document.getElementById('pickerModal').classList.remove('open');
  activePhotoSlot = null;
}

// --- 保存（ブラウザダウンロード） ---
async function saveManual() {
  const data = collectData();
  if (!data.header.title) {
    toast('タイトルを入力してください');
    return;
  }
  if (!data.baseName) data.baseName = data.header.title;

  const sheetHtml = buildSheetHtml(false);
  // </ をエスケープして script タグが途中で閉じないようにする
  const stateJson = JSON.stringify(data).replace(/<\//g, '<\\/');
  const printCssHref = new URL('css/print.css', location.href).href;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(data.header.title || '作業要領書')}</title>
  <style>${PRINT_BOOT_CSS}</style>
  <link rel="stylesheet" href="${printCssHref}">
</head>
<body class="wm-print-page">
${sheetHtml}
<script id="wm-state" type="application/json">${stateJson}<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.baseName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  state.baseName = data.baseName;
  state._previousBaseName = data.baseName;
  saveDraft();
  document.getElementById('statusText').textContent =
    `保存しました: ${data.baseName}.html（ダウンロードフォルダ）`;
  toast('保存しました');
}

// --- 開く（保存済みHTMLをアップロード） ---
function openSavedList() {
  const input = document.getElementById('openFileInput');
  if (input) input.click();
}

async function loadSavedFromFile(file) {
  try {
    const text = await file.text();
    const match = text.match(/<script id="wm-state" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('このファイルは対応した要領書ではありません（保存し直してください）');
    const data = JSON.parse(match[1]);

    state = migrateState({
      baseName: data.baseName || '',
      _previousBaseName: data.baseName || '',
      header: data.header || {},
      photoLabels: data.photoLabels,
      stepLabels: data.stepLabels,
      photos: data.photos || { '1': null, '2': null, '3': null, '4': null },
      steps: data.steps || Array.from({ length: MAX_STEPS }, () => ({ title: '', body: '' })),
      footer: data.footer || '',
      streamActive: data.streamActive
    });
    applyToForm();
    syncStreamActiveFromData();
    buildEditStream();
    saveDraft();
    toast('読み込みました');
  } catch (e) {
    toast(e.message || '読み込み失敗');
  }
}

// --- PDF / 印刷 ---
const PRINT_BOOT_CSS = `
html,body{margin:0;padding:0;background:#fff}
body.wm-print-page{font-family:'Segoe UI','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;font-size:10pt;color:#202124}
@media print{
@page{size:297mm 210mm;margin:10mm}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wm-sheet--landscape-fit{width:277mm!important;height:190mm!important;max-height:190mm!important;page-break-inside:avoid;break-inside:avoid}
}
`;

function exportPdf() {
  const sheetHtml = buildSheetHtml(false);
  const cssUrl = new URL('css/print.css', location.href).href;
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
    <title>${escapeHtml(state.header.title || '作業要領書')}</title>
    <style>${PRINT_BOOT_CSS}</style>
    <link rel="stylesheet" href="${cssUrl}">
  </head><body class="wm-print-page">${sheetHtml}</body></html>`;

  const frame = document.getElementById('wmPrintFrame');
  const win = frame.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();

  let printStarted = false;
  const startPrint = () => {
    if (printStarted) return;
    printStarted = true;
    const imgs = [...doc.images];
    let left = imgs.length;
    let goStarted = false;
    const go = () => {
      if (goStarted) return;
      goStarted = true;
      setTimeout(() => {
        win.focus();
        win.print();
      }, 150);
    };
    if (!left) return go();
    imgs.forEach(img => {
      if (img.complete) {
        if (!--left) go();
      } else {
        img.addEventListener('load', () => { if (!--left) go(); });
        img.addEventListener('error', () => { if (!--left) go(); });
      }
    });
    setTimeout(go, 3000);
  };

  const link = doc.querySelector('link[rel="stylesheet"]');
  if (link) {
    link.addEventListener('load', startPrint);
    link.addEventListener('error', startPrint);
    setTimeout(startPrint, 2500);
  } else {
    startPrint();
  }
}

// --- 下書き ---
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collectData()));
  } catch { /* quota */ }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
      || localStorage.getItem('work-manual-draft-v4')
      || localStorage.getItem('work-manual-draft-v3')
      || localStorage.getItem('work-manual-draft-v2')
      || localStorage.getItem('work-manual-draft-v1');
    if (!raw) {
      renderPreview();
      return;
    }
    const d = migrateState(JSON.parse(raw));
    state.header = d.header || state.header;
    state.photoLabels = d.photoLabels || state.photoLabels;
    state.stepLabels = d.stepLabels || state.stepLabels;
    state.photos = d.photos || state.photos;
    state.steps = d.steps || state.steps;
    state.footer = d.footer ?? state.footer;
    state.baseName = d.baseName || state.baseName;
    state.streamActive = migrateStreamActive(d);
    syncStreamActiveFromData();
    applyToForm();
    buildEditStream();
  } catch {
    renderPreview();
  }
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
