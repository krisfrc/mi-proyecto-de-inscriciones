-- Documentos requeridos para aprobación de preinscripción

CREATE TABLE IF NOT EXISTS documentos_tipos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(60) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
    permite_suplencia BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO documentos_tipos (codigo, nombre, obligatorio, permite_suplencia)
VALUES
    ('partida_nacimiento', 'Partida de nacimiento', TRUE, FALSE),
    ('cedula_representante', 'Cédula del representante', TRUE, FALSE),
    ('foto_carnet', 'Foto tipo carnet', FALSE, FALSE),
    ('carta_compromiso', 'Carta de compromiso', FALSE, TRUE)
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    obligatorio = EXCLUDED.obligatorio,
    permite_suplencia = EXCLUDED.permite_suplencia;

ALTER TABLE preinscripcion_documentos
    ADD COLUMN IF NOT EXISTS codigo_documento VARCHAR(60);
