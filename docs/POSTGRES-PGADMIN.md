# PostgreSQL + pgAdmin — Ver el flujo en tablas

El sistema guarda **todo** en PostgreSQL. Podés ver usuarios, inscripciones, estados e historial con **pgAdmin** (o DBeaver), no hace falta usar la terminal para consultar datos.

## 1. Crear la base (una sola vez)

### Opción A — PostgreSQL en Ubuntu

```bash
cd /ruta/App-inscripciones
sudo -u postgres psql -f backend/scripts/init-db.sql
sudo -u postgres psql -d escuela_inscripciones -f backend/schema/schema.sql
```

### Opción B — Docker

```bash
docker compose up -d
```

## 2. Conectar pgAdmin

Abre **pgAdmin** → clic derecho en **Servers** → **Register** → **Server**:

| Pestaña | Campo | Valor |
|---------|--------|--------|
| General | Name | Escuela Inscripciones |
| Connection | Host | `localhost` |
| Connection | Port | `5432` |
| Connection | Maintenance database | `escuela_inscripciones` |
| Connection | Username | `inscripciones` |
| Connection | Password | `inscripciones` |

Guardá la contraseña si pgAdmin lo pide.

Navegación: **Servers → Escuela Inscripciones → Databases → escuela_inscripciones → Schemas → public → Tables**

## 3. Tablas del flujo de inscripción

| Tabla | Qué ves ahí |
|-------|-------------|
| `usuarios` | Padres/tutores que se registran (login) |
| `estudiantes` | Alumnos creados por cada usuario |
| `direcciones` | Domicilios |
| `inscripciones` | Solicitud + columna **`estado`** (pendiente, en_revision, aprobada, rechazada) |
| `inscripcion_historial` | Cada cambio de estado (flujo completo) |
| `contactos` | Mensajes del formulario de contacto |
| `roles` | admin / user |

## 4. Consultas útiles en pgAdmin

Clic derecho en la base → **Query Tool**:

```sql
-- Ver inscripciones con familia, alumno y estado
SELECT
    i.id,
    i.estado,
    i.fecha,
    u.nombre || ' ' || u.apellido AS familia,
    e.nombre AS estudiante,
    e.grado
FROM inscripciones i
JOIN usuarios u ON i.usuario_id = u.id
JOIN estudiantes e ON i.estudiante_id = e.id
ORDER BY i.fecha DESC;

-- Ver historial de una inscripción (cambiar el 1 por el id)
SELECT * FROM inscripcion_historial
WHERE inscripcion_id = 1
ORDER BY creado_en;
```

## 5. Backend debe usar los mismos datos

Archivo `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=inscripciones
DB_PASSWORD=inscripciones
DB_NAME=escuela_inscripciones
```

```bash
cd backend
npm run check-db   # debe conectar
npm start
```

Cuando alguien se registra o inscribe desde la web, **refrescá la tabla en pgAdmin** (F5 o clic derecho → View/Refresh) y verás las filas nuevas.

## 6. Usuarios de prueba

| Cédula | Contraseña | Rol en `roles` |
|--------|------------|----------------|
| 1010 | 123 | admin |
| 2020 | 123 | user |
