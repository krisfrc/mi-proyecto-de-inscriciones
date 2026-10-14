-- Catálogo real de aulas: inicial por salas, 1er/2do A-B, 3ro-6to solo A, cupo 40

ALTER TABLE secciones
    ALTER COLUMN nombre TYPE VARCHAR(60);

ALTER TABLE secciones
    ALTER COLUMN cupo SET DEFAULT 40;

UPDATE secciones SET cupo = 40;

INSERT INTO grados (nombre, orden)
SELECT 'Preescolar', 0
WHERE NOT EXISTS (
    SELECT 1 FROM grados WHERE LOWER(nombre) = 'preescolar'
);

INSERT INTO secciones (grado_id, nombre, cupo)
SELECT g.id, v.nombre, 40
FROM grados g
CROSS JOIN (VALUES
    ('Sala de 3'),
    ('Sala de 4'),
    ('Sala de 5'),
    ('Sala mixta (4 y 5 años)')
) AS v(nombre)
WHERE LOWER(g.nombre) = 'preescolar'
ON CONFLICT (grado_id, nombre) DO NOTHING;

UPDATE estudiantes e
SET seccion_id = dest.id,
    grado_id = dest.grado_id,
    grado = g.nombre
FROM secciones old
JOIN grados og ON og.id = old.grado_id
JOIN grados g ON LOWER(g.nombre) = 'preescolar'
JOIN secciones dest ON dest.grado_id = g.id AND dest.nombre = 'Sala mixta (4 y 5 años)'
WHERE e.seccion_id = old.id
  AND LOWER(og.nombre) = 'preescolar'
  AND old.nombre IN ('A', 'B', 'C');

UPDATE docentes d
SET seccion_id = dest.id,
    grado_id = dest.grado_id
FROM secciones old
JOIN grados og ON og.id = old.grado_id
JOIN grados g ON LOWER(g.nombre) = 'preescolar'
JOIN secciones dest ON dest.grado_id = g.id AND dest.nombre = 'Sala mixta (4 y 5 años)'
WHERE d.seccion_id = old.id
  AND LOWER(og.nombre) = 'preescolar'
  AND old.nombre IN ('A', 'B', 'C');

UPDATE estudiantes e
SET seccion_id = a.id
FROM secciones extra
JOIN grados g ON g.id = extra.grado_id
JOIN secciones a ON a.grado_id = g.id AND a.nombre = 'A'
WHERE e.seccion_id = extra.id
  AND g.orden BETWEEN 3 AND 6
  AND extra.nombre IN ('B', 'C');

UPDATE docentes d
SET seccion_id = a.id
FROM secciones extra
JOIN grados g ON g.id = extra.grado_id
JOIN secciones a ON a.grado_id = g.id AND a.nombre = 'A'
WHERE d.seccion_id = extra.id
  AND g.orden BETWEEN 3 AND 6
  AND extra.nombre IN ('B', 'C');

UPDATE estudiantes e
SET seccion_id = b.id
FROM secciones extra
JOIN grados g ON g.id = extra.grado_id
JOIN secciones b ON b.grado_id = g.id AND b.nombre = 'B'
WHERE e.seccion_id = extra.id
  AND g.orden IN (1, 2)
  AND extra.nombre = 'C';

UPDATE docentes d
SET seccion_id = b.id
FROM secciones extra
JOIN grados g ON g.id = extra.grado_id
JOIN secciones b ON b.grado_id = g.id AND b.nombre = 'B'
WHERE d.seccion_id = extra.id
  AND g.orden IN (1, 2)
  AND extra.nombre = 'C';

DELETE FROM secciones s
USING grados g
WHERE s.grado_id = g.id
  AND (
      (LOWER(g.nombre) = 'preescolar' AND s.nombre IN ('A', 'B', 'C'))
      OR (g.orden IN (1, 2) AND s.nombre = 'C')
      OR (g.orden BETWEEN 3 AND 6 AND s.nombre IN ('B', 'C'))
  );

INSERT INTO secciones (grado_id, nombre, cupo)
SELECT g.id, 'A', 40
FROM grados g
WHERE g.orden BETWEEN 1 AND 6
ON CONFLICT (grado_id, nombre) DO NOTHING;

INSERT INTO secciones (grado_id, nombre, cupo)
SELECT g.id, 'B', 40
FROM grados g
WHERE g.orden IN (1, 2)
ON CONFLICT (grado_id, nombre) DO NOTHING;
