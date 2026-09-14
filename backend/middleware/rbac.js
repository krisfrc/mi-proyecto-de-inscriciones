/**
 * RBAC — Role-based access control middleware.
 */

const PERMISSION_COLUMNS = {
    create: 'puede_crear',
    read: 'puede_leer',
    update: 'puede_editar',
    delete: 'puede_borrar',
};

const createPermissionChecker = (pool) => (moduleName, action) => {
    const column = PERMISSION_COLUMNS[action];
    if (!column) {
        throw new Error(`Invalid RBAC action: ${action}`);
    }

    return async (req, res, next) => {
        try {
            const userId = req.query?.usuario_id || req.body?.usuario_id;

            if (!userId) {
                return res.status(403).json({
                    error: 'Acceso denegado: se requiere identificación del usuario',
                });
            }

            const result = await pool.query(
                `SELECT u.rol_id, r.nombre AS rol_nombre, p.${column} AS permitido
                 FROM usuarios u
                 JOIN roles r ON u.rol_id = r.id
                 JOIN rm_pagin rp ON rp.rol_id = u.rol_id
                 JOIN modulos m ON m.id = rp.modulo_id AND m.nombre = $2
                 JOIN permisos p ON p.id_rm_pagin = rp.id
                 WHERE u.id = $1`,
                [userId, moduleName]
            );

            if (result.rows.length === 0) {
                return res.status(403).json({
                    error: 'Acceso denegado: tu rol no tiene acceso a este módulo',
                });
            }

            if (!result.rows[0].permitido) {
                return res.status(403).json({
                    error: `Acceso denegado: tu rol (${result.rows[0].rol_nombre}) no puede ${action} en ${moduleName}`,
                });
            }

            req.authUser = { id: Number(userId), rol_id: result.rows[0].rol_id };
            next();
        } catch (err) {
            console.error('RBAC error:', err);
            res.status(500).json({ error: 'Error al verificar permisos' });
        }
    };
};

module.exports = { createPermissionChecker, PERMISSION_COLUMNS };
