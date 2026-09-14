-- Configuración institucional, docentes y cédula de estudiante

CREATE TABLE IF NOT EXISTS institucion_config (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(160) NOT NULL,
    logo_url TEXT,
    color_primario VARCHAR(20) DEFAULT '#0d5c63',
    color_secundario VARCHAR(20) DEFAULT '#e07a5f',
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO institucion_config (nombre)
SELECT 'Escuela básica nacional la cuadra de Bolivar'
WHERE NOT EXISTS (SELECT 1 FROM institucion_config);

CREATE TABLE IF NOT EXISTS docentes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    telefono VARCHAR(30),
    email VARCHAR(150),
    especialidad VARCHAR(120),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE estudiantes
    ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'ux_estudiantes_cedula'
    ) THEN
        CREATE UNIQUE INDEX ux_estudiantes_cedula
            ON estudiantes(cedula)
            WHERE cedula IS NOT NULL;
    END IF;
END $$;
