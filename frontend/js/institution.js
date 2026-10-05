const applyInstitutionTheme = (cfg) => {
    if (!cfg) return;

    if (cfg.nombre) {
        document.querySelectorAll('.brand-name').forEach((el) => {
            el.textContent = cfg.nombre;
        });
        const authTitle = document.querySelector('.auth-brand h1');
        if (authTitle) authTitle.textContent = cfg.nombre;
        document.querySelectorAll('[data-institution-name]').forEach((el) => {
            el.textContent = cfg.nombre;
        });
    }

    if (cfg.logo_url) {
        const src = window.resolveAssetUrl ? window.resolveAssetUrl(cfg.logo_url) : cfg.logo_url;
        document.querySelectorAll('.brand-icon').forEach((el) => {
            el.innerHTML = `<img src="${src}" alt="Logo institución">`;
        });
    }
};

const applyInstitutionConfig = async () => {
    try {
        const res = await fetch(`${window.API_URL || 'http://localhost:3000'}/configuracion/institucion`);
        if (!res.ok) return;
        const cfg = await res.json();
        applyInstitutionTheme(cfg);
    } catch (err) {
        console.warn('No se pudo cargar configuración institucional', err);
    }
};

window.applyInstitutionTheme = applyInstitutionTheme;
window.applyInstitutionConfig = applyInstitutionConfig;

document.addEventListener('DOMContentLoaded', applyInstitutionConfig);
