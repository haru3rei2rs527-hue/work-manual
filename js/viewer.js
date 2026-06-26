/* viewer.js — Neon DB から読み込んでマニュアルを表示する */
(function () {
  /* ── ユーティリティ ── */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
  function textToHtml(s) { return escapeHtml(s).replace(/\n/g, '<br>'); }

  /* ── URL パラメータ解析 ── */
  const params = new URLSearchParams(location.search);
  const manualId = params.get('id');

  /* ── DOM ── */
  const body    = document.getElementById('viewerBody');
  const state   = document.getElementById('viewerState');
  const btnEdit = document.getElementById('btnEdit');

  btnEdit.addEventListener('click', () => { location.href = '/'; });

  /* ── エラー表示 ── */
  function showError(msg) {
    state.className = 'vw-state error';
    state.innerHTML = `<span>⚠ ${escapeHtml(msg)}</span>`;
  }

  /* ── シートをスケール調整 ── */
  function fitScale(wrap) {
    const sheet = wrap.querySelector('.wm-sheet');
    if (!sheet) return;
    const avail = wrap.clientWidth;
    const natural = sheet.offsetWidth;
    if (!natural || !avail) return;
    const scale = Math.min(1, avail / natural);
    const rounded = Math.round(scale * 1000) / 1000;
    sheet.style.setProperty('--vw-scale', String(rounded));
    wrap.style.height = `${Math.ceil(sheet.offsetHeight * rounded) + 4}px`;
  }

  /* ── メイン：API から取得してレンダリング ── */
  async function loadManual() {
    if (!manualId) {
      showError('URLパラメータが見つかりません（?id=… が必要です）');
      return;
    }

    try {
      const res = await fetch(`/api/load?id=${encodeURIComponent(manualId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { data } = await res.json();

      /* ページタイトル更新 */
      if (data.header?.title) {
        document.title = `${data.header.title} — 作業要領書`;
      }

      /* シート HTML 生成 */
      const sheetHtml = WM_LAYOUT.buildSheet({
        data,
        editorMode: false,
        escapeHtml,
        textToHtml,
        escapeAttr,
        photoSrc: (file) => file,
      });

      /* 描画 */
      const wrap = document.createElement('div');
      wrap.className = 'vw-sheet-wrap';
      wrap.innerHTML = sheetHtml;
      state.remove();
      body.appendChild(wrap);

      /* スケール調整 */
      requestAnimationFrame(() => {
        fitScale(wrap);
        window.addEventListener('resize', () => fitScale(wrap));
      });
    } catch (err) {
      showError(err.message || '読み込みに失敗しました');
    }
  }

  loadManual();
})();
