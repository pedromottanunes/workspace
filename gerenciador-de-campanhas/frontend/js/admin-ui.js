(() => {
  const body = document.body;
  const state = { overlay: null, resolver: null, open: false };

  function ensureOverlay() {
    if (state.overlay) return state.overlay;
    const overlay = document.createElement('div');
    overlay.className = 'admin-dialog-overlay hidden';
    overlay.innerHTML = `
      <div class="admin-dialog" role="dialog" aria-modal="true">
        <div class="admin-dialog-title" id="adminDialogTitle">Confirmar</div>
        <div class="admin-dialog-message" id="adminDialogMessage"></div>
        <div class="admin-dialog-actions">
          <button type="button" class="btn btn--ghost" id="adminDialogCancel">Cancelar</button>
          <button type="button" class="btn btn--primary" id="adminDialogConfirm">Confirmar</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', evt => {
      if (evt.target === overlay) {
        closeDialog(false);
      }
    });
    body.appendChild(overlay);
    state.overlay = overlay;
    return overlay;
  }

  function closeDialog(result) {
    if (!state.overlay) return;
    state.overlay.classList.add('hidden');
    const hasOtherModal = document.querySelector('.modal:not(.hidden)');
    if (!hasOtherModal) body.style.overflow = '';
    state.open = false;
    if (state.resolver) state.resolver(result);
    state.resolver = null;
    document.removeEventListener('keydown', handleKeydown);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(false);
    }
    if (event.key === 'Enter' && state.open) {
      event.preventDefault();
      closeDialog(true);
    }
  }

  function openDialog({ title = 'Confirmar', message = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'default', hideCancel = false } = {}) {
    const overlay = ensureOverlay();
    const dialog = overlay.querySelector('.admin-dialog');
    const titleEl = overlay.querySelector('#adminDialogTitle');
    const msgEl = overlay.querySelector('#adminDialogMessage');
    const confirmBtn = overlay.querySelector('#adminDialogConfirm');
    const cancelBtn = overlay.querySelector('#adminDialogCancel');
    titleEl.textContent = title;
    msgEl.textContent = message;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.classList.toggle('btn--danger', tone === 'danger');
    if (cancelLabel) {
      cancelBtn.textContent = cancelLabel;
    }
    cancelBtn.style.display = hideCancel ? 'none' : '';

    overlay.classList.remove('hidden');
    body.style.overflow = 'hidden';
    state.open = true;

    document.removeEventListener('keydown', handleKeydown);
    document.addEventListener('keydown', handleKeydown);

    return new Promise(resolve => {
      state.resolver = resolve;

      const onConfirm = () => closeDialog(true);
      const onCancel = () => closeDialog(false);
      confirmBtn.onclick = onConfirm;
      cancelBtn.onclick = onCancel;
      confirmBtn.focus();
    });
  }

  function ensureToastRoot() {
    let root = document.querySelector('#admin-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'admin-toast-root';
      root.className = 'admin-toast-root';
      body.appendChild(root);
    }
    return root;
  }

  function adminToast(message, type = 'info', { duration = 2600 } = {}) {
    const root = ensureToastRoot();
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast--${type}`;
    toast.textContent = String(message || '');
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const timeout = duration < 800 ? 800 : duration;
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, timeout);
  }

  async function adminConfirm(message, options = {}) {
    const result = await openDialog({
      title: options.title || 'Confirmar',
      message,
      confirmLabel: options.confirmLabel || 'Confirmar',
      cancelLabel: options.cancelLabel || 'Cancelar',
      tone: options.tone || 'default',
    });
    return Boolean(result);
  }

  async function adminAlert(message, options = {}) {
    await openDialog({
      title: options.title || 'Aviso',
      message,
      confirmLabel: options.confirmLabel || 'OK',
      cancelLabel: options.cancelLabel || null,
      hideCancel: true,
      tone: options.tone || 'default',
    });
  }

  window.adminConfirm = adminConfirm;
  window.adminAlert = adminAlert;
  window.adminToast = adminToast;
})();
