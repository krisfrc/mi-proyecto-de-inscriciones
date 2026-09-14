-- Ejecutar como superusuario de PostgreSQL:
--   sudo -u postgres psql -f backend/scripts/init-db.sql

CREATE USER inscripciones WITH PASSWORD 'inscripciones';
CREATE DATABASE escuela_inscripciones OWNER inscripciones;
GRANT ALL PRIVILEGES ON DATABASE escuela_inscripciones TO inscripciones;
