(function () {
  const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  let editMode = false;
  const storageKey = 'workshop-edit:' + window.location.pathname;

  // 편집 가능한 요소 (페이지 네비·버튼 제외)
  const SELECTOR = [
    '.main-content h1', '.main-content h2', '.main-content h3',
    '.main-content p', '.main-content li',
    '.main-content td', '.main-content th',
    '.main-content pre',
    '.page-hero h1', '.page-hero p',
    '.hero-section h1', '.hero-section p'
  ].join(', ');

  /* ── 헤더에 버튼 삽입 ── */
  function injectButtons() {
    const nav = document.querySelector('.nav-inner');
    if (!nav) return;

    const editBtn = Object.assign(document.createElement('button'), {
      id: 'edit-btn',
      textContent: '✏️ 편집'
    });
    styleBtn(editBtn, false);
    editBtn.onclick = toggleEdit;

    const resetBtn = Object.assign(document.createElement('button'), {
      id: 'reset-btn',
      textContent: '↺ 초기화'
    });
    Object.assign(resetBtn.style, {
      padding: '5px 10px', background: 'transparent',
      color: '#DC2626', border: '1px solid #FECACA',
      borderRadius: '6px', fontSize: '12px', fontWeight: '600',
      cursor: 'pointer', marginLeft: '4px', display: 'none'
    });
    resetBtn.onclick = resetContent;

    nav.appendChild(editBtn);
    nav.appendChild(resetBtn);

    // 로컬 서버일 때만 "파일 저장" 버튼 추가
    if (IS_LOCAL) {
      const saveFileBtn = Object.assign(document.createElement('button'), {
        id: 'save-file-btn',
        textContent: '💾 파일 저장'
      });
      Object.assign(saveFileBtn.style, {
        padding: '5px 12px', background: '#166534', color: 'white',
        border: 'none', borderRadius: '6px', fontSize: '12px',
        fontWeight: '600', cursor: 'pointer', marginLeft: '4px'
      });
      saveFileBtn.onclick = saveToFile;
      nav.appendChild(saveFileBtn);
    }
  }

  function styleBtn(btn, active) {
    Object.assign(btn.style, {
      padding: '5px 12px',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? 'white' : 'var(--text-2)',
      border: active ? 'none' : '1px solid var(--border)',
      borderRadius: '6px', fontSize: '12px', fontWeight: '600',
      cursor: 'pointer', marginLeft: '8px'
    });
  }

  /* ── 편집 모드 토글 ── */
  function toggleEdit() {
    editMode = !editMode;
    const editBtn = document.getElementById('edit-btn');
    const resetBtn = document.getElementById('reset-btn');

    if (editMode) {
      editBtn.textContent = '✓ 완료';
      styleBtn(editBtn, true);
      resetBtn.style.display = 'inline-block';
      enableEditing();
    } else {
      editBtn.textContent = '✏️ 편집';
      styleBtn(editBtn, false);
      disableEditing();
      saveContent();
    }
  }

  function enableEditing() {
    document.querySelectorAll(SELECTOR).forEach(el => {
      if (el.closest('.page-nav')) return;
      el.contentEditable = 'true';
      el.dataset.editActive = '1';
      el.style.outline = '1.5px dashed #FCA98E';
      el.style.borderRadius = '3px';
    });
  }

  function disableEditing() {
    document.querySelectorAll('[data-edit-active]').forEach(el => {
      el.contentEditable = 'false';
      delete el.dataset.editActive;
      el.style.outline = '';
      el.style.borderRadius = '';
    });
  }

  /* ── localStorage 저장 / 불러오기 / 초기화 ── */
  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveContent, 800);
  }

  function saveContent() {
    const data = {};
    const main = document.querySelector('.main-content');
    if (main) data.main = main.innerHTML;
    const hero = document.querySelector('.hero-section, .page-hero');
    if (hero) data.hero = hero.innerHTML;
    localStorage.setItem(storageKey, JSON.stringify(data));
    toast('저장됨 ✓');
  }

  function loadContent() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const main = document.querySelector('.main-content');
      if (main && data.main) main.innerHTML = data.main;
      const hero = document.querySelector('.hero-section, .page-hero');
      if (hero && data.hero) hero.innerHTML = data.hero;
    } catch {
      const main = document.querySelector('.main-content');
      if (main) main.innerHTML = raw;
    }
  }

  function resetContent() {
    if (confirm('이 페이지의 모든 변경사항을 초기화할까요?')) {
      localStorage.removeItem(storageKey);
      location.reload();
    }
  }

  /* ── 파일로 저장 (로컬 서버 전용) ── */
  async function saveToFile() {
    const fileName = location.pathname.replace(/^\//, '') || 'index.html';

    // DevTools 편집 포함 전체 HTML 가져오기
    const html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

    try {
      const res = await fetch('/__save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: fileName, html })
      });
      if (res.ok) {
        toast('📁 파일 저장 완료: ' + fileName);
      } else {
        toast('❌ 저장 실패');
      }
    } catch {
      toast('❌ 서버에 연결할 수 없습니다');
    }
  }

  /* ── Cmd+S / Ctrl+S 단축키 (로컬에서 파일 저장) ── */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (IS_LOCAL) saveToFile();
      else saveContent();
    }
  });

  /* ── 인라인 편집 시 자동 저장 ── */
  document.addEventListener('input', e => {
    if (e.target.contentEditable === 'true') scheduleSave();
  });

  /* ── 토스트 알림 ── */
  function toast(msg) {
    const el = Object.assign(document.createElement('div'), { textContent: msg });
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', right: '24px',
      background: '#1C1917', color: 'white',
      padding: '9px 16px', borderRadius: '8px',
      fontSize: '13px', zIndex: '9999',
      opacity: '1', transition: 'opacity 0.3s'
    });
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 1800);
  }

  /* ── 초기화 ── */
  document.addEventListener('DOMContentLoaded', () => {
    loadContent();
    injectButtons();
  });
})();
