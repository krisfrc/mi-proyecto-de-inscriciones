-- RBAC: módulo Administración (solo admin) y permisos de familia

INSERT INTO modulos (nombre)
SELECT 'Administración'
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'Administración');

-- Admin → módulo Administración (acceso total)
INSERT INTO rm_pagin (rol_id, modulo_id, pagina)
SELECT 1, m.id, '/admin/dashboard'
FROM modulos m
WHERE m.nombre = 'Administración'
  AND NOT EXISTS (
    SELECT 1 FROM rm_pagin rp
    JOIN modulos mo ON mo.id = rp.modulo_id
    WHERE rp.rol_id = 1 AND mo.nombre = 'Administración'
  );

INSERT INTO permisos (id_rm_pagin, puede_crear, puede_leer, puede_editar, puede_borrar)
SELECT rp.id, true, true, true, true
FROM rm_pagin rp
JOIN modulos m ON m.id = rp.modulo_id
WHERE rp.rol_id = 1 AND m.nombre = 'Administración'
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.id_rm_pagin = rp.id);

-- Familia → módulo Inscripciones (solo sus datos)
INSERT INTO rm_pagin (rol_id, modulo_id, pagina)
SELECT 2, m.id, '/user/panel'
FROM modulos m
WHERE m.nombre = 'Inscripciones'
  AND NOT EXISTS (
    SELECT 1 FROM rm_pagin rp WHERE rp.rol_id = 2 AND rp.modulo_id = m.id
  );

INSERT INTO permisos (id_rm_pagin, puede_crear, puede_leer, puede_editar, puede_borrar)
SELECT rp.id, true, true, true, false
FROM rm_pagin rp
JOIN modulos m ON m.id = rp.modulo_id
WHERE rp.rol_id = 2 AND m.nombre = 'Inscripciones'
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.id_rm_pagin = rp.id);
