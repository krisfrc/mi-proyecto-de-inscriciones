-- Vaciar TODO sin datos de prueba (base totalmente en blanco)
-- Después tendrás que registrarte desde la web para crear el primer usuario.

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

-- Solo roles (necesarios para registrar usuarios con rol_id = 2)
INSERT INTO roles (nombre) VALUES ('admin'), ('user');
