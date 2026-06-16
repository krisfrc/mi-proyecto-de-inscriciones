const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');
const { createPermissionChecker } = require('./middleware/rbac');

const app = express();
const checkPermission = createPermissionChecker(pool);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
const VALID_STATUSES = ['pendiente', 'en_revision', 'aprobada', 'rechazada'];

const recordEnrollmentHistory = async (client, enrollmentId, previousStatus, newStatus, userId, note) => {
    await client.query(
        `INSERT INTO inscripcion_historial (inscripcion_id, estado_anterior, estado_nuevo, usuario_id, nota)
         VALUES ($1, $2, $3, $4, $5)`,
        [enrollmentId, previousStatus, newStatus, userId, note || null]
    );
};

// --- FUNCIONALIDAD COMPARTIDA / UTILS ---

const checkAdminRead = checkPermission('Administración', 'read');
const checkAdminUpdate = checkPermission('Administración', 'update');

// --- RUTAS DE ADMIN (Control Total) ---

app.get('/admin/inscripciones', checkAdminRead, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.id, 
                i.estado,
                i.fecha,
                i.observaciones,
                u.nombre AS usuario_nombre, 
                u.apellido AS usuario_apellido, 
                e.nombre AS estudiante,
                e.grado
            FROM inscripciones i
            JOIN usuarios u ON i.usuario_id = u.id
            JOIN estudiantes e ON i.estudiante_id = e.id
            ORDER BY i.fecha DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ruta global de direcciones para Admin
app.get('/admin/direcciones', checkAdminRead, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                d.*, 
                u.nombre AS usuario_nombre, 
                u.apellido AS usuario_apellido 
            FROM direcciones d 
            JOIN usuarios u ON d.id_user = u.id
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Editar estudiante (Solo Admin)
app.put('/estudiantes/:id', checkAdminUpdate, async (req, res) => {
    const { id } = req.params;
    const { nombre, grado } = req.body;
    try {
        await pool.query(
            'UPDATE estudiantes SET nombre = $1, grado = $2 WHERE id = $3',
            [nombre, grado, id]
        );
        res.json({ message: "Estudiante actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/estudiantes', async (req, res) => {
    const result = await pool.query('SELECT * FROM estudiantes'); // Sin WHERE
    res.json(result.rows);
});

// --- 1. RUTAS DE USUARIO & LOGIN ---

app.post('/usuarios', async (req, res) => {
    const { nombre, apellido, cedula, contraseña } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO usuarios (nombre, apellido, cedula, contraseña, rol_id) 
             VALUES ($1, $2, $3, $4, 2) RETURNING id, cedula, nombre`,
            [nombre, apellido, cedula, contraseña]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Error al registrar: " + err.message });
    }
});

app.post('/login', async (req, res) => {
    const { cedula, contraseña } = req.body;
    try {
        const result = await pool.query(
            `SELECT u.*, r.nombre as rol_nombre 
             FROM usuarios u 
             JOIN roles r ON u.rol_id = r.id 
             WHERE u.cedula = $1 AND u.contraseña = $2`,
            [cedula, contraseña]
        );
        if (result.rows.length === 0) return res.status(401).json({ error: "Cédula o contraseña incorrecta" });
        res.json({ message: "Login exitoso", usuario: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. RUTAS PARA ESTUDIANTES ---

app.get('/estudiantes/usuario', async (req, res) => {
    const { usuario_id } = req.query;
    try {
        const result = await pool.query('SELECT * FROM estudiantes WHERE usuario_id = $1', [usuario_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/estudiantes', async (req, res) => {
    const { nombre, grado, usuario_id } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO estudiantes (nombre, grado, usuario_id) VALUES ($1, $2, $3) RETURNING *',
            [nombre, grado, usuario_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. RUTAS PARA DIRECCIONES ---

app.get('/direcciones/usuario', async (req, res) => {
    const { usuario_id } = req.query;
    try {
        const result = await pool.query('SELECT * FROM direcciones WHERE id_user = $1', [usuario_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/direcciones', async (req, res) => {
    const { calle, av, barrio, sector, n_casa, parroquia, municipio, estado, state, id_user } = req.body;
    const barrioVal = barrio || sector;
    const estadoVal = estado || state;
    try {
        const result = await pool.query(
            `INSERT INTO direcciones (calle, av, barrio, n_casa, parroquia, municipio, estado, id_user) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [calle, av || '', barrioVal, n_casa, parroquia, municipio, estadoVal, id_user]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/direcciones/:id', async (req, res) => {
    const { id } = req.params;
    const { id_user } = req.body;
    try {
        const user = await pool.query('SELECT rol_id FROM usuarios WHERE id = $1', [id_user]);
        if (user.rows.length > 0 && user.rows[0].rol_id === 1) {
            await pool.query('DELETE FROM direcciones WHERE id = $1', [id]);
        } else {
            await pool.query('DELETE FROM direcciones WHERE id = $1 AND id_user = $2', [id, id_user]);
        }
        res.json({ message: 'Dirección eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. RUTAS PARA INSCRIPCIONES ---

app.post('/inscripciones', async (req, res) => {
    const { estudiante_id, usuario_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            `INSERT INTO inscripciones (estudiante_id, usuario_id, estado) 
             VALUES ($1, $2, 'pendiente') RETURNING *`,
            [estudiante_id, usuario_id]
        );
        const inscripcion = result.rows[0];
        await recordEnrollmentHistory(
            client,
            inscripcion.id,
            null,
            'pendiente',
            usuario_id,
            'Inscripción creada'
        );
        await client.query('COMMIT');
        res.status(201).json(inscripcion);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(400).json({ error: "El estudiante ya posee una inscripción activa." });
        }
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.patch('/inscripciones/:id/estado', checkAdminUpdate, async (req, res) => {
    const { id } = req.params;
    const { estado, observaciones, usuario_id } = req.body;
    if (!VALID_STATUSES.includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const actual = await client.query('SELECT estado FROM inscripciones WHERE id = $1', [id]);
        if (actual.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }
        const estadoAnterior = actual.rows[0].estado;
        const result = await client.query(
            `UPDATE inscripciones 
             SET estado = $1, observaciones = COALESCE($2, observaciones), actualizado_en = CURRENT_TIMESTAMP 
             WHERE id = $3 RETURNING *`,
            [estado, observaciones, id]
        );
        await recordEnrollmentHistory(
            client,
            id,
            estadoAnterior,
            estado,
            usuario_id,
            observaciones || `Estado cambiado a ${estado}`
        );
        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get('/inscripciones/:id/historial', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT h.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
             FROM inscripcion_historial h
             LEFT JOIN usuarios u ON h.usuario_id = u.id
             WHERE h.inscripcion_id = $1
             ORDER BY h.creado_en ASC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/inscripciones/usuario', async (req, res) => {
    const { usuario_id } = req.query;
    try {
        const result = await pool.query(`
            SELECT i.id, i.estado, i.fecha, i.observaciones,
                   e.nombre as estudiante_nombre, e.grado
            FROM inscripciones i
            JOIN estudiantes e ON i.estudiante_id = e.id
            WHERE i.usuario_id = $1
            ORDER BY i.fecha DESC
        `, [usuario_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/inscripciones/:id', async (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;
    try {
        const user = await pool.query('SELECT rol_id FROM usuarios WHERE id = $1', [usuario_id]);
        if (user.rows.length > 0 && user.rows[0].rol_id === 1) {
            await pool.query('DELETE FROM inscripciones WHERE id = $1', [id]);
        } else {
            await pool.query('DELETE FROM inscripciones WHERE id = $1 AND usuario_id = $2', [id, usuario_id]);
        }
        res.json({ message: 'Inscripción eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/contactos', async (req, res) => {
    const { nombre, email, mensaje } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO contactos (nombre, email, mensaje) VALUES ($1, $2, $3) RETURNING *',
            [nombre, email || null, mensaje]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/contactos', checkAdminRead, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM contactos ORDER BY creado_en DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

pool.query('SELECT NOW()')
    .then(() => console.log('PostgreSQL conectado'))
    .catch((err) => console.error('Error PostgreSQL:', err.message));

app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
});