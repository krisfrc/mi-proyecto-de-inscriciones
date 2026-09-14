-- Dirección al estilo Venezuela: estado, municipio, parroquia (sin provincia)

ALTER TABLE direcciones RENAME COLUMN state TO estado;

ALTER TABLE direcciones
    ADD COLUMN IF NOT EXISTS municipio VARCHAR(100),
    ADD COLUMN IF NOT EXISTS parroquia VARCHAR(100);

-- sector pasa a llamarse barrio en la base
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'direcciones' AND column_name = 'sector'
    ) THEN
        ALTER TABLE direcciones RENAME COLUMN sector TO barrio;
    END IF;
END $$;

-- Mensajes de contacto: el visitante no necesita email
ALTER TABLE contactos ALTER COLUMN email DROP NOT NULL;
