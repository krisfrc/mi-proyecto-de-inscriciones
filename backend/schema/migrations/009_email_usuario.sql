ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS email VARCHAR(150);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'ux_usuarios_email'
    ) THEN
        CREATE UNIQUE INDEX ux_usuarios_email
            ON usuarios (LOWER(email))
            WHERE email IS NOT NULL AND BTRIM(email) <> '';
    END IF;
END $$;
