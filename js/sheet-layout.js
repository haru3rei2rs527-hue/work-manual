/**
 * 作業要領書シート — 項目数に応じたレイアウト（ブラウザ / Node 共通）
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.WM_LAYOUT = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_PHOTOS = 4;
  const MAX_STEPS = 10;
  const PHOTO_NUM = ['①', '②', '③', '④'];
  const STEP_NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  const EDIT_STREAM = [
    { type: 'photo', slot: 1 },
    { type: 'step', idx: 0 },
    { type: 'photo', slot: 2 },
    { type: 'step', idx: 1 },
    { type: 'step', idx: 2 },
    { type: 'photo', slot: 3 },
    { type: 'step', idx: 3 },
    { type: 'photo', slot: 4 },
    { type: 'step', idx: 4 },
    { type: 'step', idx: 5 },
    { type: 'step', idx: 6 },
    { type: 'step', idx: 7 },
    { type: 'step', idx: 8 },
    { type: 'step', idx: 9 }
  ];

  function normalizePhotoEntry(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') return { file: raw, x: 0, y: 0, scale: 1 };
    if (typeof raw === 'object' && raw.file) {
      return {
        file: raw.file,
        x: Number(raw.x) || 0,
        y: Number(raw.y) || 0,
        scale: Math.min(5, Math.max(0.15, Number(raw.scale) || 1))
      };
    }
    return null;
  }

  function defaultStreamActive() {
    return {
      photos: { '1': true, '2': false, '3': false, '4': false },
      steps: Object.fromEntries(
        Array.from({ length: MAX_STEPS }, (_, i) => [String(i), false])
      )
    };
  }

  function getStreamActive(data) {
    if (data.streamActive?.photos && data.streamActive?.steps) return data.streamActive;
    return defaultStreamActive();
  }

  function isBlockActive(block, streamActive) {
    if (block.type === 'photo') return !!streamActive.photos[String(block.slot)];
    return !!streamActive.steps[String(block.idx)];
  }

  /** 左ペインで追加された項目のみ、ストリーム順で収集 */
  function collectActiveItems(data) {
    const streamActive = getStreamActive(data);
    const photos = [];
    const steps = [];
    EDIT_STREAM.forEach(block => {
      if (!isBlockActive(block, streamActive)) return;
      if (block.type === 'photo') {
        const slot = block.slot;
        const entry = normalizePhotoEntry(data.photos?.[String(slot)]);
        photos.push({
          slot,
          label: data.photoLabels?.[String(slot)] || PHOTO_NUM[slot - 1],
          entry
        });
      } else {
        const idx = block.idx;
        const s = data.steps?.[idx] || {};
        steps.push({
          idx,
          label: data.stepLabels?.[String(idx)] || STEP_NUM[idx],
          title: (s.title || '').trim(),
          body: (s.body || '').trim()
        });
      }
    });
    return { photos, steps };
  }

  /** A4横向き（277×190mm）に収めるグリッド設定 */
  function computeLayoutSpec(photoCount, stepCount) {
    const p = photoCount;
    const s = stepCount;
    const bodyHmm = 158;

    let leftPct = 0;
    let rightPct = 0;
    if (p > 0 && s > 0) {
      leftPct = Math.round(Math.min(58, Math.max(34, 36 + p * 5 - s * 2)));
      rightPct = 100 - leftPct;
    } else if (p > 0) {
      leftPct = 100;
      rightPct = 0;
    } else if (s > 0) {
      leftPct = 0;
      rightPct = 100;
    }

    const photoRows = p <= 0 ? 0 : p === 1 ? 1 : p <= 2 ? 1 : 2;
    const photoCols = p <= 0 ? 0 : p === 1 ? 1 : 2;
    const photoHmm = p > 0 ? Math.max(28, Math.floor(bodyHmm / photoRows) - 3) : 0;

    const stepCols = s <= 0 ? 0 : s <= 3 ? 1 : 2;
    const stepRows = s <= 0 ? 0 : Math.ceil(s / stepCols);
    const stepHmm = s > 0 ? Math.max(14, Math.floor(bodyHmm / stepRows) - 3) : 0;

    const dense = p + s >= 8;

    return {
      bodyStyle: p > 0 && s > 0 ? `grid-template-columns:${leftPct}% ${rightPct}%` : '',
      bodyClass: `wm-body wm-body--fit wm-body--p${p}-s${s}`,
      sheetClass: `wm-sheet wm-sheet--landscape-fit${dense ? ' wm-sheet--dense' : ''}`,
      photosClass: `wm-photos wm-photos--n${p}`,
      stepsClass: `wm-steps wm-steps--n${s}${dense ? ' wm-steps--dense' : ''}`,
      photoCellStyle: photoHmm ? `min-height:${photoHmm}mm` : '',
      stepCellStyle: stepHmm ? `min-height:${stepHmm}mm` : '',
      hidePhotos: p === 0,
      hideSteps: s === 0,
      photoRows,
      photoCols
    };
  }

  function photoTransformStyle(entry) {
    if (!entry) return '';
    return `--wm-px:${entry.x}px;--wm-py:${entry.y}px;--wm-scale:${entry.scale}`;
  }

  function buildSheet(opts) {
    const {
      data,
      editorMode = false,
      escapeHtml,
      textToHtml,
      escapeAttr,
      photoSrc
    } = opts;

    const { photos, steps } = collectActiveItems(data);
    const spec = computeLayoutSpec(photos.length, steps.length);

    const photoCells = photos.map(p => {
      const src = p.entry ? photoSrc(p.entry.file, p.slot) : '';
      const inner = p.entry
        ? `<div class="wm-photo-frame"><img src="${escapeAttr(src)}" alt="" style="${photoTransformStyle(p.entry)}">${editorMode ? '<span class="wm-photo-adjust-hint">ドラッグで移動 · 右下でサイズ</span><div class="wm-photo-resize" title="拡大縮小"></div>' : ''}</div>`
        : '<div class="wm-photo-empty">写真を選択</div>';
      const editable = editorMode && p.entry ? ' wm-photo-editable' : '';
      const dataSlot = editorMode ? ` data-slot="${p.slot}"` : '';
      const emptyClass = !p.entry && editorMode ? ' wm-photo-cell--empty' : '';
      return `<div class="wm-photo-cell${editable}${emptyClass}"${dataSlot} style="${spec.photoCellStyle}"><span class="wm-badge wm-badge-photo">${escapeHtml(p.label)}</span>${inner}</div>`;
    }).join('');

    const stepCells = steps.map(st => {
      const title = st.title ? `<div class="wm-step-title">${escapeHtml(st.title)}</div>` : '';
      const body = st.body
        ? `<div class="wm-step-body">${textToHtml(st.body)}</div>`
        : '<div class="wm-step-body wm-muted">—</div>';
      return `<div class="wm-step-cell" style="${spec.stepCellStyle}"><span class="wm-badge wm-badge-step">${escapeHtml(st.label)}</span>${title}${body}</div>`;
    }).join('');

    const photosBlock = spec.hidePhotos
      ? ''
      : `<div class="${spec.photosClass}">${photoCells}</div>`;
    const stepsBlock = spec.hideSteps
      ? ''
      : `<div class="${spec.stepsClass}">${stepCells}</div>`;

    const bodyStyle = spec.bodyStyle ? ` style="${spec.bodyStyle}"` : '';

    return `
    <div class="${spec.sheetClass}">
      <header class="wm-header">
        <h1 class="wm-title">${escapeHtml(data.header?.title || '作業要領書')}</h1>
        <div class="wm-meta">
          <span>日付: ${escapeHtml(data.header?.date || '—')}</span>
          ${data.header?.author ? `<span>作成: ${escapeHtml(data.header.author)}</span>` : ''}
        </div>
      </header>
      <div class="${spec.bodyClass}"${bodyStyle}>
        ${photosBlock}
        ${stepsBlock}
      </div>
      <footer class="wm-footer">
        <div class="wm-footer-label">補足説明・注意事項</div>
        <div class="wm-footer-body">${data.footer ? textToHtml(data.footer) : '<span class="wm-muted">—</span>'}</div>
      </footer>
    </div>`;
  }

  return {
    MAX_PHOTOS,
    MAX_STEPS,
    EDIT_STREAM,
    PHOTO_NUM,
    STEP_NUM,
    defaultStreamActive,
    collectActiveItems,
    computeLayoutSpec,
    buildSheet,
    normalizePhotoEntry,
    getStreamActive
  };
});
