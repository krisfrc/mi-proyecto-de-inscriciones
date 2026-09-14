const applyInstitutionConfig = async () => {
    try {
        const res = await fetch(`${window.API_URL || 'http://localhost:3000'}/configuracion/institucion`);
        if (!res.ok) return;
        const cfg = await res.json();

        if (cfg.color_primario) {
            document.documentElement.style.setProperty('--color-primary', cfg.color_primario);
            document.documentElement.style.setProperty('--teal-800', cfg.color_primario);
        }
        if (cfg.color_secundario) {
            document.documentElement.style.setProperty('--color-accent', cfg.color_secundario);
            document.documentElement.style.setProperty('--coral', cfg.color_secundario);
        }

        if (cfg.nombre) {
            document.querySelectorAll('.brand-name').forEach((el) => {
                el.textContent = cfg.nombre;
            });
            const authTitle = document.querySelector('.auth-brand h1');
            if (authTitle) authTitle.textContent = cfg.nombre;
        }

        if (cfg.logo_url) {
            const src = window.resolveAssetUrl ? window.resolveAssetUrl(cfg.logo_url) : cfg.logo_url;
            document.querySelectorAll('.brand-icon').forEach((el) => {
                el.innerHTML = `<img src="${src}" alt="Logo institución">`;
            });
        }
    } catch (err) {
        console.warn('No se pudo cargar configuración institucional', err);
    }
};

document.addEventListener('DOMContentLoaded', applyInstitutionConfig);
