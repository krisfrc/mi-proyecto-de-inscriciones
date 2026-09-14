-- Preescolar, asignación de docentes a grado/sección y logo local

INSERT INTO grados (nombre, orden)
SELECT 'Preescolar', COALESCE((SELECT MIN(orden) FROM grados), 1) - 1
WHERE NOT EXISTS (
    SELECT 1 FROM grados WHERE LOWER(nombre) = 'preescolar'
);

INSERT INTO secciones (grado_id, nombre)
SELECT g.id, s.nombre
FROM grados g
CROSS JOIN (VALUES ('A'), ('B'), ('C')) AS s(nombre)
WHERE LOWER(g.nombre) = 'preescolar'
ON CONFLICT (grado_id, nombre) DO NOTHING;

ALTER TABLE docentes
    ADD COLUMN IF NOT EXISTS grado_id INTEGER REFERENCES grados(id),
    ADD COLUMN IF NOT EXISTS seccion_id INTEGER REFERENCES secciones(id),
    ADD COLUMN IF NOT EXISTS periodo_id INTEGER REFERENCES periodos_escolares(id);
