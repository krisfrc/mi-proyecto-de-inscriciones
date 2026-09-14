-- Operatividad de inscripciones: periodo, grado, sección y documentos de preinscripción

CREATE TABLE IF NOT EXISTS periodos_escolares (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(60) UNIQUE NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO periodos_escolares (nombre, fecha_inicio, fecha_fin, activo)
SELECT
    'Periodo ' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1),
    make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 9, 1),
    make_date((EXTRACT(YEAR FROM CURRENT_DATE)::int + 1), 7, 31),
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM periodos_escolares WHERE activo = TRUE);

CREATE TABLE IF NOT EXISTS grados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(40) UNIQUE NOT NULL,
    orden INTEGER NOT NULL UNIQUE
);

INSERT INTO grados (nombre, orden)
VALUES
    ('1er Grado', 1),
    ('2do Grado', 2),
    ('3er Grado', 3),
    ('4to Grado', 4),
    ('5to Grado', 5),
    ('6to Grado', 6)
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS secciones (
    id SERIAL PRIMARY KEY,
    grado_id INTEGER NOT NULL REFERENCES grados(id) ON DELETE CASCADE,
    nombre VARCHAR(5) NOT NULL,
    UNIQUE (grado_id, nombre)
);

INSERT INTO secciones (grado_id, nombre)
SELECT g.id, s.nombre
FROM grados g
CROSS JOIN (VALUES ('A'), ('B'), ('C')) AS s(nombre)
ON CONFLICT (grado_id, nombre) DO NOTHING;

ALTER TABLE estudiantes
    ADD COLUMN IF NOT EXISTS grado_id INTEGER REFERENCES grados(id),
    ADD COLUMN IF NOT EXISTS seccion_id INTEGER REFERENCES secciones(id);

UPDATE estudiantes e
SET grado_id = g.id
FROM grados g
WHERE e.grado_id IS NULL
  AND e.grado IS NOT NULL
  AND e.grado LIKE '%' || g.orden::text || '%';

UPDATE estudiantes e
SET seccion_id = s.id
FROM secciones s
WHERE e.seccion_id IS NULL
  AND e.grado_id = s.grado_id
  AND s.nombre = 'A';

ALTER TABLE inscripciones
    ADD COLUMN IF NOT EXISTS periodo_id INTEGER REFERENCES periodos_escolares(id);

UPDATE inscripciones i
SET periodo_id = p.id
FROM periodos_escolares p
WHERE i.periodo_id IS NULL
  AND p.activo = TRUE;

CREATE TABLE IF NOT EXISTS preinscripcion_documentos (
    id SERIAL PRIMARY KEY,
    inscripcion_id INTEGER NOT NULL REFERENCES inscripciones(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(200) NOT NULL,
    ruta_archivo TEXT NOT NULL,
    tipo_documento VARCHAR(80),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_grado_seccion ON estudiantes(grado_id, seccion_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_periodo_estado ON inscripciones(periodo_id, estado);
CREATE INDEX IF NOT EXISTS idx_docs_inscripcion ON preinscripcion_documentos(inscripcion_id);
