-- Vaciar TODAS las tablas y reiniciar IDs (empezar de 0)
-- Ejecutar en pgAdmin: Query Tool → base escuela_inscripciones → F5
-- (como usuario postgres o inscripciones con permisos)

TRUNCATE TABLE
    inscripcion_historial,
    inscripciones,
    estudiantes,
    direcciones,
    contactos,
    permisos,
    rm_pagin,
    modulos,
    usuarios,
    roles
RESTART IDENTITY CASCADE;

-- Opcional: datos mínimos para que el sistema funcione (admin + roles)
-- Si querés TODO vacío sin usuarios, no ejecutes la sección de abajo.

INSERT INTO roles (nombre) VALUES ('admin'), ('user');

INSERT INTO usuarios (nombre, apellido, cedula, contraseña, rol_id) VALUES
('Admin', 'Escuela', '1010', '123', 1);

INSERT INTO modulos (nombre) VALUES ('Inscripciones'), ('Ajustes');

INSERT INTO rm_pagin (rol_id, modulo_id, pagina) VALUES (1, 1, '/admin/reportes');

INSERT INTO permisos (id_rm_pagin, puede_crear, puede_leer, puede_editar, puede_borrar)
VALUES (1, true, true, true, true);
