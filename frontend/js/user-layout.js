const USER_LINKS = [
    { id: 'estudiantes', href: 'usuario_dashboard.html#estudiantes', label: '👤 Estudiantes' },
    { id: 'direcciones', href: 'usuario_dashboard.html#direcciones', label: '📍 Direcciones' },
    { id: 'inscripciones', href: 'usuario_dashboard.html#inscripciones', label: '📝 Inscripciones' },
];

const renderUserNavLinks = (activeId) => USER_LINKS.map((link) => (
    `<li><a href="${link.href}" class="${link.id === activeId ? 'active' : ''}">${link.label}</a></li>`
)).join('');

const mountUserChrome = () => {
    const user = JSON.parse(localStorage.getItem('usuario') || 'null');
    if (!user) {
        window.location.href = '../login/login.html';
        return null;
    }
    if (user.rol_id === 1) {
        window.location.href = '../admin/admin_dashboard.html';
        return null;
    }
    const activeId = document.body.dataset.userPage || 'estudiantes';
    const header = document.querySelector('[data-user-header]');
    if (header) {
        header.innerHTML = `
            <a href="usuario_dashboard.html#estudiantes" class="brand">
                <span class="brand-icon">🎓</span>
                <span class="brand-name">Escuela básica nacional la cuadra de Bolivar</span>
            </a>
            <nav>
                <span id="user-greeting" class="user-chip">${user.nombre}</span>
                <a href="usuario_dashboard.html#configuracion" class="header-config-btn ${activeId === 'cuenta' ? 'is-active' : ''}" title="Configuración" aria-label="Configuración">⚙️</a>
                <a href="../index.html" class="btn btn-ghost btn-sm">Inicio</a>
                <button id="logout-btn" class="btn btn-ghost btn-sm" type="button">Salir</button>
            </nav>
        `;
    }
    const sidebar = document.querySelector('[data-user-sidebar]');
    if (sidebar) {
        sidebar.innerHTML = `
            <div class="sidebar-brand" data-institution-name>Escuela básica nacional la cuadra de Bolivar</div>
            <ul class="sidebar-nav">${renderUserNavLinks(activeId)}</ul>
        `;
    }
    const mobile = document.querySelector('[data-user-mobile]');
    if (mobile) {
        mobile.innerHTML = `<ul>${renderUserNavLinks(activeId)}</ul>`;
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('usuario');
            window.location.href = '../login/login.html';
        });
    }
    return user;
};

window.mountUserChrome = mountUserChrome;
document.addEventListener('DOMContentLoaded', () => {
    mountUserChrome();
    if (window.applyInstitutionConfig) window.applyInstitutionConfig();
});
