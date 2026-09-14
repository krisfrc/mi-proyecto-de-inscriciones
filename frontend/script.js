document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.querySelector('.auth-buttons-main');
    const userStorage = localStorage.getItem('usuario');

    if (userStorage && authContainer) {
        const user = JSON.parse(userStorage);
        const panelUrl = user.rol_id === 1
            ? 'admin/admin_dashboard.html'
            : 'user/usuario_dashboard.html';

        authContainer.innerHTML = `
            <span class="user-chip">${user.nombre}</span>
            <a href="${panelUrl}" class="btn btn-primary btn-sm">Mi panel</a>
            <button id="logout-btn" class="btn btn-ghost btn-sm">Salir</button>
        `;

        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('usuario');
            window.location.reload();
        });
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(contactForm));
            try {
                const res = await fetch(`${window.API_URL || 'http://localhost:3000'}/contactos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    showToast('Mensaje enviado. Te responderemos pronto.', 'success');
                    contactForm.reset();
                } else {
                    showToast('No se pudo enviar el mensaje', 'error');
                }
            } catch {
                showToast('Servidor no disponible', 'error');
            }
        });
    }
});
