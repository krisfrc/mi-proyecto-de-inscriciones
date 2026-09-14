const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
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
const uploadDir = path.join(__dirname, 'uploads', 'preinscripciones');
const logoDir = path.join(__dirname, 'uploads', 'institucion');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(logoDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '.pdf');
        const base = path.basename(file.originalname || 'documento', ext).replace(/\s+/g, '_');
        cb(null, `${Date.now()}-${base}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por archivo
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            cb(new Error('Solo se permiten archivos PDF'));
            return;
        }
        cb(null, true);
    },
});

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']);
const logoUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, logoDir),
        filename: (_req, file, cb) => {
            const ext = (path.extname(file.originalname || '.png') || '.png').toLowerCase();
            cb(null, `logo-${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
            cb(new Error('Solo se permiten imágenes (PNG, JPG, WEBP o SVG)'));
            return;
        }
        cb(null, true);
    },
});

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
const PRE_ENROLLMENT_STATES = ['pendiente', 'en_revision', 'rechazada'];

const parsePageValue = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const comparePassword = async (plainPassword, storedPassword) => {
    if (!storedPassword) return false;
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
        return bcrypt.compare(plainPassword, storedPassword);
    }
    return plainPassword === storedPassword;
};

const resolveStudentCedula = async (client, usuarioId, providedCedula) => {
    if (providedCedula && String(providedCedula).trim()) {
        return String(providedCedula).trim();
    }

    const representativeResult = await client.query(
        'SELECT cedula FROM usuarios WHERE id = $1',
        [usuarioId]
    );
    if (!representativeResult.rows.length) {
        throw new Error('Representante no encontrado para generar cédula del alumno');
    }

    const representativeCedula = representativeResult.rows[0].cedula || '';
    const base = Number.parseInt(representativeCedula.replace(/\D/g, ''), 10);

    const maxStudentResult = await client.query(
        `SELECT MAX(CAST(cedula AS BIGINT)) AS max_cedula
         FROM estudiantes
         WHERE usuario_id = $1
           AND cedula ~ '^[0-9]+$'`,
        [usuarioId]
    );
    if (maxStudentResult.rows[0].max_cedula) {
        return String(Number(maxStudentResult.rows[0].max_cedula) + 1);
    }
    if (!Number.isNaN(base) && base > 0) {
        return String(base + 1);
    }
    return `${Date.now()}`;
};

const buildEnrollmentFilters = ({ tab, gradoId, seccionId, periodoId, queryText }) => {
    const where = [];
    const params = [];
    let idx = 1;

    if (tab === 'inscritos') {
        where.push(`i.estado = $${idx++}`);
        params.push('aprobada');
    } else {
        where.push(`i.estado = ANY($${idx++}::text[])`);
        params.push(PRE_ENROLLMENT_STATES);
    }

    if (gradoId) {
        where.push(`COALESCE(e.grado_id, g.id) = $${idx++}`);
        params.push(gradoId);
    }
    if (seccionId) {
        where.push(`e.seccion_id = $${idx++}`);
        params.push(seccionId);
    }
    if (periodoId) {
        where.push(`i.periodo_id = $${idx++}`);
        params.push(periodoId);
    }
    if (queryText) {
        where.push(`(
            u.nombre ILIKE $${idx}
            OR u.apellido ILIKE $${idx}
            OR e.nombre ILIKE $${idx}
            OR u.cedula ILIKE $${idx}
        )`);
        params.push(`%${queryText}%`);
        idx++;
    }

    return {
        params,
        nextIndex: idx,
        whereClause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    };
};

const httpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const resolveGradeAndSection = async (client, { grado, grado_id, seccion_id }) => {
    let gradeText = grado || null;
    let resolvedGradeId = grado_id ? Number(grado_id) : null;
    let resolvedSectionId = seccion_id ? Number(seccion_id) : null;

    if (resolvedGradeId) {
        const gradeResult = await client.query('SELECT id, nombre FROM grados WHERE id = $1', [resolvedGradeId]);
        if (!gradeResult.rows.length) {
            throw httpError(400, 'Grado no válido');
        }
        gradeText = gradeResult.rows[0].nombre;
    }

    if (resolvedSectionId) {
        const sectionResult = await client.query(
            'SELECT id, nombre, grado_id FROM secciones WHERE id = $1',
            [resolvedSectionId]
        );
        if (!sectionResult.rows.length) {
            throw httpError(400, 'Sección no válida');
        }
        if (resolvedGradeId && sectionResult.rows[0].grado_id !== resolvedGradeId) {
            throw httpError(400, 'La sección no corresponde al grado seleccionado');
        }
        if (!resolvedGradeId) {
            resolvedGradeId = sectionResult.rows[0].grado_id;
            const gradeResult = await client.query('SELECT nombre FROM grados WHERE id = $1', [resolvedGradeId]);
            gradeText = gradeResult.rows.length ? gradeResult.rows[0].nombre : gradeText;
        }
    }

    return { gradeText, resolvedGradeId, resolvedSectionId };
};

const insertStudent = async (client, { nombre, usuarioId, grado, grado_id, seccion_id, cedula }) => {
    if (!nombre || !String(nombre).trim()) {
        throw httpError(400, 'El nombre del estudiante es obligatorio');
    }
    const { gradeText, resolvedGradeId, resolvedSectionId } = await resolveGradeAndSection(client, {
        grado,
        grado_id,
        seccion_id,
    });
    const resolvedCedula = await resolveStudentCedula(client, usuarioId, cedula);
    const result = await client.query(
        `INSERT INTO estudiantes (nombre, grado, usuario_id, grado_id, seccion_id, cedula)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [String(nombre).trim(), gradeText, usuarioId, resolvedGradeId, resolvedSectionId, resolvedCedula]
    );
    return result.rows[0];
};

// --- RUTAS DE ADMIN (Control Total) ---

app.get('/admin/inscripciones', checkAdminRead, async (req, res) => {
    const tab = req.query.tab === 'inscritos' ? 'inscritos' : 'preinscritos';
    const gradoId = req.query.grado_id ? Number(req.query.grado_id) : null;
    const seccionId = req.query.seccion_id ? Number(req.query.seccion_id) : null;
    const periodoId = req.query.periodo_id ? Number(req.query.periodo_id) : null;
    const queryText = (req.query.q || '').trim();
    const page = parsePageValue(req.query.page, 1);
    const pageSize = Math.min(parsePageValue(req.query.page_size, 10), 50);
    const offset = (page - 1) * pageSize;

    try {
        const filters = buildEnrollmentFilters({ tab, gradoId, seccionId, periodoId, queryText });
        const { whereClause } = filters;

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM inscripciones i
             JOIN usuarios u ON i.usuario_id = u.id
             JOIN estudiantes e ON i.estudiante_id = e.id
             LEFT JOIN grados g ON e.grado_id = g.id
             ${whereClause}`,
            filters.params
        );

        const dataParams = [...filters.params, pageSize, offset];
        const limitParam = filters.nextIndex++;
        const offsetParam = filters.nextIndex++;
        const result = await pool.query(
            `SELECT
                i.id,
                i.estado,
                i.fecha,
                i.observaciones,
                u.nombre AS usuario_nombre,
                u.apellido AS usuario_apellido,
                u.cedula AS usuario_cedula,
                e.nombre AS estudiante,
                COALESCE(g.nombre, e.grado, 'Sin grado') AS grado_nombre,
                s.nombre AS seccion_nombre,
                p.nombre AS periodo_nombre
             FROM inscripciones i
             JOIN usuarios u ON i.usuario_id = u.id
             JOIN estudiantes e ON i.estudiante_id = e.id
             LEFT JOIN grados g ON e.grado_id = g.id
             LEFT JOIN secciones s ON e.seccion_id = s.id
             LEFT JOIN periodos_escolares p ON i.periodo_id = p.id
             ${whereClause}
             ORDER BY i.fecha DESC
             LIMIT $${limitParam} OFFSET $${offsetParam}`,
            dataParams
        );

        res.json({
            rows: result.rows,
            pagination: {
                page,
                page_size: pageSize,
                total: countResult.rows[0].total,
                total_pages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize)),
            },
            filters: { tab, grado_id: gradoId, seccion_id: seccionId, periodo_id: periodoId, q: queryText },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/inscripciones/export.csv', checkAdminRead, async (req, res) => {
    const tab = req.query.tab === 'inscritos' ? 'inscritos' : 'preinscritos';
    const gradoId = req.query.grado_id ? Number(req.query.grado_id) : null;
    const seccionId = req.query.seccion_id ? Number(req.query.seccion_id) : null;
    const periodoId = req.query.periodo_id ? Number(req.query.periodo_id) : null;
    const queryText = (req.query.q || '').trim();
    try {
        const filters = buildEnrollmentFilters({ tab, gradoId, seccionId, periodoId, queryText });
        const result = await pool.query(
            `SELECT
                i.id,
                i.estado,
                i.fecha,
                u.nombre AS usuario_nombre,
                u.apellido AS usuario_apellido,
                u.cedula AS usuario_cedula,
                e.nombre AS estudiante,
                COALESCE(g.nombre, e.grado, 'Sin grado') AS grado_nombre,
                COALESCE(s.nombre, '') AS seccion_nombre,
                COALESCE(p.nombre, '') AS periodo_nombre
             FROM inscripciones i
             JOIN usuarios u ON i.usuario_id = u.id
             JOIN estudiantes e ON i.estudiante_id = e.id
             LEFT JOIN grados g ON e.grado_id = g.id
             LEFT JOIN secciones s ON e.seccion_id = s.id
             LEFT JOIN periodos_escolares p ON i.periodo_id = p.id
             ${filters.whereClause}
             ORDER BY i.fecha DESC`,
            filters.params
        );

        const lines = [
            ['ID', 'Estado', 'Fecha', 'Representante', 'Cédula', 'Estudiante', 'Grado', 'Sección', 'Período']
                .map(escapeCsv).join(','),
        ];
        result.rows.forEach((row) => {
            lines.push([
                row.id,
                row.estado,
                new Date(row.fecha).toLocaleString('es'),
                `${row.usuario_nombre} ${row.usuario_apellido}`,
                row.usuario_cedula,
                row.estudiante,
                row.grado_nombre,
                row.seccion_nombre,
                row.periodo_nombre,
            ].map(escapeCsv).join(','));
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="inscripciones-${tab}.csv"`);
        res.send(lines.join('\n'));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/inscripciones/catalogos', checkAdminRead, async (req, res) => {
    try {
        const [grades, sections, periods] = await Promise.all([
            pool.query('SELECT id, nombre, orden FROM grados ORDER BY orden ASC'),
            pool.query(
                `SELECT s.id, s.nombre, s.grado_id, g.nombre AS grado_nombre, g.orden
                 FROM secciones s
                 JOIN grados g ON g.id = s.grado_id
                 ORDER BY g.orden ASC, s.nombre ASC`
            ),
            pool.query('SELECT id, nombre, activo FROM periodos_escolares ORDER BY id DESC'),
        ]);
        res.json({
            grados: grades.rows,
            secciones: sections.rows,
            periodos: periods.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/catalogos/escolares', async (_req, res) => {
    try {
        const [grades, sections, periods] = await Promise.all([
            pool.query('SELECT id, nombre, orden FROM grados ORDER BY orden ASC'),
            pool.query(
                `SELECT s.id, s.nombre, s.grado_id, g.nombre AS grado_nombre, g.orden
                 FROM secciones s
                 JOIN grados g ON g.id = s.grado_id
                 ORDER BY g.orden ASC, s.nombre ASC`
            ),
            pool.query('SELECT id, nombre, activo FROM periodos_escolares ORDER BY id DESC'),
        ]);
        res.json({
            grados: grades.rows,
            secciones: sections.rows,
            periodos: periods.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/catalogos/documentos', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, codigo, nombre, obligatorio, permite_suplencia
             FROM documentos_tipos
             ORDER BY obligatorio DESC, id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/representantes', checkAdminRead, async (req, res) => {
    const q = String(req.query.q || '').trim();
    try {
        const params = [];
        let where = 'WHERE u.rol_id = 2';
        if (q) {
            params.push(`%${q}%`);
            where += ` AND (u.nombre ILIKE $1 OR u.apellido ILIKE $1 OR u.cedula ILIKE $1)`;
        }
        const result = await pool.query(
            `SELECT u.id, u.nombre, u.apellido, u.cedula
             FROM usuarios u
             ${where}
             ORDER BY u.apellido ASC, u.nombre ASC
             LIMIT 200`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/preinscripciones', upload.array('documentos', 8), checkAdminUpdate, async (req, res) => {
    const operadorId = Number(req.body.usuario_id);
    const representanteId = Number(req.body.representante_id);
    const { nombre, grado, grado_id, seccion_id, cedula, periodo_id, codigo_documento, tipo_documento } = req.body;
    if (!representanteId || !nombre) {
        return res.status(400).json({ error: 'Debes elegir un representante y el nombre del alumno' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const representative = await client.query(
            `SELECT id, nombre, apellido, cedula, rol_id FROM usuarios WHERE id = $1`,
            [representanteId]
        );
        if (!representative.rows.length || Number(representative.rows[0].rol_id) === 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El representante no existe. Debe registrarse primero como usuario.' });
        }

        const student = await insertStudent(client, {
            nombre,
            usuarioId: representanteId,
            grado,
            grado_id,
            seccion_id,
            cedula,
        });

        let periodoId = periodo_id || null;
        if (!periodoId) {
            const periodResult = await client.query(
                'SELECT id FROM periodos_escolares WHERE activo = TRUE ORDER BY id DESC LIMIT 1'
            );
            periodoId = periodResult.rows.length ? periodResult.rows[0].id : null;
        }

        const enrollmentResult = await client.query(
            `INSERT INTO inscripciones (estudiante_id, usuario_id, estado, periodo_id)
             VALUES ($1, $2, 'pendiente', $3) RETURNING *`,
            [student.id, representanteId, periodoId]
        );
        const inscripcion = enrollmentResult.rows[0];

        const operator = await client.query('SELECT nombre, apellido FROM usuarios WHERE id = $1', [operadorId]);
        const operatorName = operator.rows[0]
            ? `${operator.rows[0].nombre} ${operator.rows[0].apellido}`
            : 'operador';
        await recordEnrollmentHistory(
            client,
            inscripcion.id,
            null,
            'pendiente',
            operadorId,
            `Preinscripción creada por operador ${operatorName}`
        );

        const files = req.files || [];
        const insertedDocs = [];
        let resolvedCode = codigo_documento || null;
        if (resolvedCode) {
            const codeExists = await client.query('SELECT codigo FROM documentos_tipos WHERE codigo = $1', [resolvedCode]);
            if (!codeExists.rows.length) resolvedCode = null;
        }
        for (const file of files) {
            const route = `/uploads/preinscripciones/${file.filename}`;
            const saved = await client.query(
                `INSERT INTO preinscripcion_documentos (inscripcion_id, nombre_archivo, ruta_archivo, tipo_documento, codigo_documento)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [inscripcion.id, file.originalname, route, tipo_documento || 'Documento PDF', resolvedCode]
            );
            insertedDocs.push(saved.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({
            estudiante: student,
            inscripcion,
            documentos: insertedDocs,
            representante: representative.rows[0],
        });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        if (err.code === '23505') {
            return res.status(400).json({ error: 'El estudiante ya posee una inscripción activa o la cédula ya existe.' });
        }
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get('/configuracion/institucion', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre, logo_url, color_primario, color_secundario, actualizado_en
             FROM institucion_config
             ORDER BY id ASC
             LIMIT 1`
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'No existe configuración institucional' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/inscripciones/:id/detalle', checkAdminRead, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT
                i.id,
                i.estado,
                i.fecha,
                i.observaciones,
                i.actualizado_en,
                p.nombre AS periodo_nombre,
                u.id AS representante_id,
                u.nombre AS representante_nombre,
                u.apellido AS representante_apellido,
                u.cedula AS representante_cedula,
                e.id AS estudiante_id,
                e.nombre AS estudiante_nombre,
                COALESCE(g.nombre, e.grado, 'Sin grado') AS grado_nombre,
                s.nombre AS seccion_nombre,
                d.calle,
                d.av,
                d.barrio,
                d.n_casa,
                d.parroquia,
                d.municipio,
                d.estado AS direccion_estado
             FROM inscripciones i
             JOIN usuarios u ON i.usuario_id = u.id
             JOIN estudiantes e ON i.estudiante_id = e.id
             LEFT JOIN grados g ON e.grado_id = g.id
             LEFT JOIN secciones s ON e.seccion_id = s.id
             LEFT JOIN periodos_escolares p ON i.periodo_id = p.id
             LEFT JOIN LATERAL (
                SELECT *
                FROM direcciones dd
                WHERE dd.id_user = u.id
                ORDER BY dd.id DESC
                LIMIT 1
             ) d ON true
             WHERE i.id = $1`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/inscripciones/:id/documentos', checkAdminRead, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT id, nombre_archivo, ruta_archivo, tipo_documento, codigo_documento, creado_en
             FROM preinscripcion_documentos
             WHERE inscripcion_id = $1
             ORDER BY creado_en DESC`,
            [id]
        );
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
    const result = await pool.query(
        `SELECT e.*, g.nombre AS grado_nombre, s.nombre AS seccion_nombre
         FROM estudiantes e
         LEFT JOIN grados g ON e.grado_id = g.id
         LEFT JOIN secciones s ON e.seccion_id = s.id
         ORDER BY e.id DESC`
    );
    res.json(result.rows);
});

// --- 1. RUTAS DE USUARIO & LOGIN ---

app.post('/usuarios', async (req, res) => {
    const { nombre, apellido, cedula, contraseña } = req.body;
    try {
        const passwordHash = await bcrypt.hash(contraseña, 10);
        const result = await pool.query(
            `INSERT INTO usuarios (nombre, apellido, cedula, contraseña, rol_id) 
             VALUES ($1, $2, $3, $4, 2) RETURNING id, cedula, nombre`,
            [nombre, apellido, cedula, passwordHash]
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
             WHERE u.cedula = $1`,
            [cedula]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Cédula o contraseña incorrecta" });
        }
        const user = result.rows[0];
        const isValid = await comparePassword(contraseña, user.contraseña);
        if (!isValid) {
            return res.status(401).json({ error: "Cédula o contraseña incorrecta" });
        }
        if (!(user.contraseña || '').startsWith('$2')) {
            const migratedHash = await bcrypt.hash(contraseña, 10);
            await pool.query('UPDATE usuarios SET contraseña = $1 WHERE id = $2', [migratedHash, user.id]);
            user.contraseña = migratedHash;
        }
        res.json({ message: "Login exitoso", usuario: user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. RUTAS PARA ESTUDIANTES ---

app.get('/estudiantes/usuario', async (req, res) => {
    const { usuario_id } = req.query;
    try {
        const result = await pool.query(
            `SELECT e.*, g.nombre AS grado_nombre, s.nombre AS seccion_nombre
             FROM estudiantes e
             LEFT JOIN grados g ON e.grado_id = g.id
             LEFT JOIN secciones s ON e.seccion_id = s.id
             WHERE e.usuario_id = $1
             ORDER BY e.id DESC`,
            [usuario_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/estudiantes', async (req, res) => {
    const { nombre, grado, grado_id, seccion_id, usuario_id, representante_id, cedula } = req.body;
    let client;
    try {
        client = await pool.connect();
        const actor = await client.query('SELECT id, rol_id FROM usuarios WHERE id = $1', [usuario_id]);
        if (!actor.rows.length) {
            return res.status(400).json({ error: 'Usuario no válido' });
        }
        const isAdmin = Number(actor.rows[0].rol_id) === 1;
        if (!isAdmin && representante_id && Number(representante_id) !== Number(usuario_id)) {
            return res.status(403).json({ error: 'No puedes preinscribir a nombre de otro representante' });
        }
        const ownerId = isAdmin && representante_id ? Number(representante_id) : Number(usuario_id);
        const student = await insertStudent(client, {
            nombre,
            usuarioId: ownerId,
            grado,
            grado_id,
            seccion_id,
            cedula,
        });
        res.status(201).json(student);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        if (err.code === '23505') {
            return res.status(400).json({ error: 'La cédula del estudiante ya existe.' });
        }
        res.status(500).json({ error: err.message });
    } finally {
        if (client) client.release();
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
    const { estudiante_id, usuario_id, periodo_id } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let periodoId = periodo_id || null;
        if (!periodoId) {
            const periodResult = await client.query(
                'SELECT id FROM periodos_escolares WHERE activo = TRUE ORDER BY id DESC LIMIT 1'
            );
            periodoId = periodResult.rows.length ? periodResult.rows[0].id : null;
        }
        const result = await client.query(
            `INSERT INTO inscripciones (estudiante_id, usuario_id, estado, periodo_id) 
             VALUES ($1, $2, 'pendiente', $3) RETURNING *`,
            [estudiante_id, usuario_id, periodoId]
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

app.post('/inscripciones/:id/documentos', upload.array('documentos', 8), async (req, res) => {
    const { id } = req.params;
    const usuarioId = Number(req.body.usuario_id);
    const documentCode = req.body.codigo_documento || null;
    const tipoDocumento = req.body.tipo_documento || 'Documento PDF';
    if (!req.files || !req.files.length) {
        return res.status(400).json({ error: 'Debes adjuntar al menos un PDF' });
    }
    try {
        const enrollment = await pool.query(
            'SELECT id, usuario_id FROM inscripciones WHERE id = $1',
            [id]
        );
        if (!enrollment.rows.length) {
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }

        const user = await pool.query('SELECT rol_id FROM usuarios WHERE id = $1', [usuarioId]);
        const isAdmin = user.rows.length && user.rows[0].rol_id === 1;
        if (!isAdmin && enrollment.rows[0].usuario_id !== usuarioId) {
            return res.status(403).json({ error: 'No autorizado para adjuntar documentos en esta inscripción' });
        }

        const inserted = [];
        let resolvedCode = documentCode;
        if (resolvedCode) {
            const codeExists = await pool.query('SELECT codigo FROM documentos_tipos WHERE codigo = $1', [resolvedCode]);
            if (!codeExists.rows.length) {
                return res.status(400).json({ error: 'Tipo de documento no válido' });
            }
        }

        for (const file of req.files) {
            const route = `/uploads/preinscripciones/${file.filename}`;
            const saved = await pool.query(
                `INSERT INTO preinscripcion_documentos (inscripcion_id, nombre_archivo, ruta_archivo, tipo_documento, codigo_documento)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [id, file.originalname, route, tipoDocumento, resolvedCode]
            );
            inserted.push(saved.rows[0]);
        }
        res.status(201).json(inserted);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        if (estado === 'aprobada') {
            const requiredDocs = await client.query(
                `SELECT codigo
                 FROM documentos_tipos
                 WHERE obligatorio = TRUE`
            );
            const uploadedDocs = await client.query(
                `SELECT codigo_documento
                 FROM preinscripcion_documentos
                 WHERE inscripcion_id = $1`,
                [id]
            );
            const uploadedCodes = new Set(uploadedDocs.rows.map((row) => row.codigo_documento).filter(Boolean));
            const hasCommitmentLetter = uploadedCodes.has('carta_compromiso');
            const missingRequired = requiredDocs.rows
                .map((row) => row.codigo)
                .filter((code) => !uploadedCodes.has(code));
            if (missingRequired.length && !hasCommitmentLetter) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: `Faltan documentos obligatorios para aprobar: ${missingRequired.join(', ')}. También puedes cargar carta_compromiso.`,
                });
            }
        }
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
                   e.nombre as estudiante_nombre, COALESCE(g.nombre, e.grado) AS grado,
                   s.nombre AS seccion
            FROM inscripciones i
            JOIN estudiantes e ON i.estudiante_id = e.id
            LEFT JOIN grados g ON e.grado_id = g.id
            LEFT JOIN secciones s ON e.seccion_id = s.id
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

app.get('/admin/usuarios', checkAdminRead, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.nombre, u.apellido, u.cedula, u.rol_id, r.nombre AS rol_nombre
             FROM usuarios u
             JOIN roles r ON r.id = u.rol_id
             ORDER BY u.id DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/admin/usuarios/:id/password', checkAdminUpdate, async (req, res) => {
    const { id } = req.params;
    const { nueva_contraseña } = req.body;
    if (!nueva_contraseña || nueva_contraseña.length < 3) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 3 caracteres' });
    }
    try {
        const hash = await bcrypt.hash(nueva_contraseña, 10);
        await pool.query(
            'UPDATE usuarios SET contraseña = $1 WHERE id = $2',
            [hash, id]
        );
        res.json({ message: 'Contraseña actualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/configuracion/institucion', checkAdminRead, async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nombre, logo_url, color_primario, color_secundario, actualizado_en
             FROM institucion_config
             ORDER BY id ASC
             LIMIT 1`
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'No existe configuración institucional' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/admin/configuracion/institucion', checkAdminUpdate, async (req, res) => {
    const { nombre, logo_url, color_primario, color_secundario } = req.body;
    if (!nombre || !String(nombre).trim()) {
        return res.status(400).json({ error: 'El nombre de la institución es obligatorio' });
    }
    try {
        const current = await pool.query('SELECT * FROM institucion_config ORDER BY id ASC LIMIT 1');
        const nextLogo = logo_url !== undefined ? (logo_url || null) : (current.rows[0]?.logo_url || null);
        if (!current.rows.length) {
            const created = await pool.query(
                `INSERT INTO institucion_config (nombre, logo_url, color_primario, color_secundario)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [nombre.trim(), nextLogo, color_primario || '#0d5c63', color_secundario || '#e07a5f']
            );
            return res.json(created.rows[0]);
        }
        const updated = await pool.query(
            `UPDATE institucion_config
             SET nombre = $1,
                 logo_url = $2,
                 color_primario = $3,
                 color_secundario = $4,
                 actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [
                nombre.trim(),
                nextLogo,
                color_primario || '#0d5c63',
                color_secundario || '#e07a5f',
                current.rows[0].id,
            ]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/configuracion/institucion/logo', logoUpload.single('logo'), checkAdminUpdate, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Debes adjuntar una imagen de logo' });
    }
    const logoUrl = `/uploads/institucion/${req.file.filename}`;
    try {
        const current = await pool.query('SELECT id FROM institucion_config ORDER BY id ASC LIMIT 1');
        if (!current.rows.length) {
            const created = await pool.query(
                `INSERT INTO institucion_config (nombre, logo_url)
                 VALUES ($1, $2) RETURNING *`,
                ['Escuela básica nacional la cuadra de Bolivar', logoUrl]
            );
            return res.json(created.rows[0]);
        }
        const updated = await pool.query(
            `UPDATE institucion_config
             SET logo_url = $1, actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [logoUrl, current.rows[0].id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/docentes', checkAdminRead, async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.id, d.nombre, d.apellido, d.cedula, d.telefono, d.email, d.especialidad,
                    d.activo, d.creado_en, d.grado_id, d.seccion_id, d.periodo_id,
                    g.nombre AS grado_nombre, s.nombre AS seccion_nombre
             FROM docentes d
             LEFT JOIN grados g ON g.id = d.grado_id
             LEFT JOIN secciones s ON s.id = d.seccion_id
             ORDER BY d.creado_en DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/docentes', checkAdminUpdate, async (req, res) => {
    const { nombre, apellido, cedula, telefono, email, especialidad, activo, grado_id, seccion_id, periodo_id } = req.body;
    if (!nombre || !apellido || !cedula) {
        return res.status(400).json({ error: 'Nombre, apellido y cédula son obligatorios' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO docentes (nombre, apellido, cedula, telefono, email, especialidad, activo, grado_id, seccion_id, periodo_id)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), $8, $9, $10)
             RETURNING *`,
            [
                nombre,
                apellido,
                cedula,
                telefono || null,
                email || null,
                especialidad || null,
                activo,
                grado_id || null,
                seccion_id || null,
                periodo_id || null,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'La cédula del docente ya existe.' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete('/admin/docentes/:id', checkAdminUpdate, async (req, res) => {
    try {
        await pool.query('DELETE FROM docentes WHERE id = $1', [req.params.id]);
        res.json({ message: 'Docente eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use((err, _req, res, next) => {
    if (!err) return next();
    if (err.message && (err.message.includes('Solo se permiten archivos PDF') || err.message.includes('Solo se permiten imágenes'))) {
        return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido.' });
    }
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

pool.query('SELECT NOW()')
    .then(() => console.log('PostgreSQL conectado'))
    .catch((err) => console.error('Error PostgreSQL:', err.message));

app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
});