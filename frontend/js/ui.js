const showToast = (message, type = 'info') => {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' toast--error' : type === 'success' ? ' toast--success' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};

const ensureSysDialog = () => {
    let backdrop = document.getElementById('sys-dialog-backdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'sys-dialog-backdrop';
    backdrop.className = 'modal-backdrop sys-dialog-backdrop';
    backdrop.innerHTML = `
        <div class="modal-card sys-dialog-card" role="dialog" aria-modal="true">
            <div class="modal-header">
                <h3 id="sys-dialog-title">Aviso</h3>
            </div>
            <p id="sys-dialog-message" class="sys-dialog-message"></p>
            <div class="form-field" id="sys-dialog-input-wrap" hidden>
                <label for="sys-dialog-input">Valor</label>
                <input type="text" id="sys-dialog-input">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-outline" id="sys-dialog-cancel">Cancelar</button>
                <button type="button" class="btn btn-primary" id="sys-dialog-ok">Aceptar</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    return backdrop;
};

const openSysDialog = ({ title, message, input = false, defaultValue = '', confirmLabel = 'Aceptar', showCancel = true }) => (
    new Promise((resolve) => {
        const backdrop = ensureSysDialog();
        const inputWrap = document.getElementById('sys-dialog-input-wrap');
        const inputEl = document.getElementById('sys-dialog-input');
        const cancelBtn = document.getElementById('sys-dialog-cancel');
        const okBtn = document.getElementById('sys-dialog-ok');
        document.getElementById('sys-dialog-title').textContent = title || 'Aviso';
        document.getElementById('sys-dialog-message').textContent = message || '';
        okBtn.textContent = confirmLabel;
        cancelBtn.hidden = !showCancel;
        inputWrap.hidden = !input;
        inputEl.value = defaultValue || '';
        backdrop.classList.add('visible');
        if (input) setTimeout(() => inputEl.focus(), 30);

        const finish = (value) => {
            backdrop.classList.remove('visible');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(value);
        };
        okBtn.onclick = () => finish(input ? inputEl.value : true);
        cancelBtn.onclick = () => finish(input ? null : false);
    })
);

const showConfirm = (message, title = 'Confirmar') => openSysDialog({
    title,
    message,
    confirmLabel: 'Confirmar',
    showCancel: true,
});

const showAlert = (message, title = 'Aviso') => openSysDialog({
    title,
    message,
    confirmLabel: 'Cerrar',
    showCancel: false,
});

const showPrompt = (message, title = 'Ingresar dato', defaultValue = '') => openSysDialog({
    title,
    message,
    input: true,
    defaultValue,
    confirmLabel: 'Aceptar',
    showCancel: true,
});

const openModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('visible');
};

const closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
};

const bindConfigMenu = (toggleEl, menuEl, items = []) => {
    if (!toggleEl || !menuEl) return;
    if (items.length) {
        menuEl.innerHTML = items.map((item) => (
            `<button type="button" class="config-menu__item" data-config-action="${item.id}">${item.label}</button>`
        )).join('');
    }
    const close = () => menuEl.hidden = true;
    toggleEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menuEl.hidden = !menuEl.hidden;
    });
    menuEl.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', close);
};

window.showToast = showToast;
window.showConfirm = showConfirm;
window.showAlert = showAlert;
window.showPrompt = showPrompt;
window.openModal = openModal;
window.closeModal = closeModal;
window.bindConfigMenu = bindConfigMenu;
