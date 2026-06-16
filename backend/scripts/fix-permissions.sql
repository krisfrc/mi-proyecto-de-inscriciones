-- Ejecutar en pgAdmin como usuario postgres (servidor misDB)
-- Query Tool en la base escuela_inscripciones

-- Dueño de tablas y secuencias
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO inscripciones', r.tablename);
    END LOOP;
    FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO inscripciones', r.sequence_name);
    END LOOP;
END $$;

-- Permisos por si acaso
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO inscripciones;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO inscripciones;
GRANT USAGE ON SCHEMA public TO inscripciones;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO inscripciones;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO inscripciones;
