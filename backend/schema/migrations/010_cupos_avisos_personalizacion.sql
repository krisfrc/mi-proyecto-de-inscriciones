-- Cupo por aula, avisos colectivos a representantes y personalización del estudiante

ALTER TABLE secciones
    ADD COLUMN IF NOT EXISTS cupo INTEGER NOT NULL DEFAULT 30;

UPDATE secciones SET cupo = 30 WHERE cupo IS NULL OR cupo < 0;

ALTER TABLE estudiantes
    ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
    ADD COLUMN IF NOT EXISTS sexo VARCHAR(20),
    ADD COLUMN IF NOT EXISTS observaciones TEXT,
    ADD COLUMN IF NOT EXISTS alergias TEXT,
    ADD COLUMN IF NOT EXISTS foto_url TEXT;

CREATE TABLE IF NOT EXISTS avisos_colectivos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(160) NOT NULL,
    mensaje TEXT NOT NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_avisos_creado ON avisos_colectivos(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_estudiantes_seccion_cupo ON estudiantes(seccion_id);
