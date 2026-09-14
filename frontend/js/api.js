/**
 * URL del backend Express (puerto 3000).
 * Si abrís el HTML con Live Server (5500), las peticiones van igual al API correcto.
 */
(() => {
    const port = window.location.port;
    const host = window.location.hostname;

    if (port === '3000' || (port === '' && window.location.protocol !== 'file:')) {
        window.API_URL = window.location.origin;
    } else {
        const h = host === '127.0.0.1' ? 'localhost' : host;
        window.API_URL = `http://${h}:3000`;
    }

    window.resolveAssetUrl = (url) => {
        if (!url) return '';
        if (/^https?:\/\//i.test(url)) return url;
        const base = String(window.API_URL || 'http://localhost:3000').replace(/\/$/, '');
        return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
    };
})();
