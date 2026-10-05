const mountAdminChrome = () => {
    const user = JSON.parse(localStorage.getItem('usuario') || 'null');
    if (!user || user.rol_id !== 1) {
        window.location.href = '../login/login.html';
        return null;
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && !logoutBtn.dataset.bound) {
        logoutBtn.dataset.bound = '1';
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('usuario');
            window.location.href = '../login/login.html';
        });
    }
    return user;
};

window.mountAdminChrome = mountAdminChrome;
document.addEventListener('DOMContentLoaded', () => {
    mountAdminChrome();
    if (window.applyInstitutionConfig) window.applyInstitutionConfig();
});
