# Sistema de inscripciones — Escuela básica nacional la cuadra de Bolivar

Aplicación web para inscripciones: funciona en celular y PC. API Node.js y base de datos **PostgreSQL**.

## Arquitectura

```
Navegador (celular o PC)  →  Express API (:3000)  →  PostgreSQL
```

## Documentación para la materia

| Documento | Contenido |
|-----------|-----------|
| [docs/CHECKLIST-MATERIA.md](docs/CHECKLIST-MATERIA.md) | Requisitos: cliente/servidor, RBAC, ejecución |
| [docs/DIAGRAMA-ER.md](docs/DIAGRAMA-ER.md) | Diagrama entidad-relación |
| [docs/SEGURIDAD-RBAC.md](docs/SEGURIDAD-RBAC.md) | Seguridad informática por roles |
| [docs/PASO-A-PASO-PGADMIN.md](docs/PASO-A-PASO-PGADMIN.md) | Configurar PostgreSQL |

## Seguridad por roles (RBAC)

El sistema restringe el acceso según el rol de cada usuario (admin / familia). Detalle: [docs/SEGURIDAD-RBAC.md](docs/SEGURIDAD-RBAC.md)

## Requisitos

- **PostgreSQL** (obligatorio) — ahí se guarda y se ve el flujo: tablas, estados, historial. Usá **pgAdmin** o DBeaver para visualizarlo (no hace falta la terminal). Guía: [docs/POSTGRES-PGADMIN.md](docs/POSTGRES-PGADMIN.md)
- [Docker](https://docs.docker.com/get-docker/) (opcional) o PostgreSQL instalado en el sistema
- [Node.js](https://nodejs.org/) 18+

## 1. Base de datos PostgreSQL

### Opción A: Docker (recomendado)

```bash
cd /ruta/App-inscripciones
docker compose up -d
```

La primera vez se ejecutan automáticamente `schema.sql` y la migración de flujo.

### Opción B: PostgreSQL ya instalado

```bash
createdb escuela_inscripciones
psql -d escuela_inscripciones -f backend/schema/schema.sql
```

Si la BD ya existía sin las tablas nuevas:

```bash
psql -d escuela_inscripciones -f backend/schema/migrations/002_flujo_inscripcion.sql
```

## 2. Backend

```bash
cd backend
cp .env.example .env   # importante: usuario inscripciones, NO postgres
npm install
npm run check-db       # debe decir "PostgreSQL conectado"
npm start
```

Servidor: [http://localhost:3000](http://localhost:3000)

### Si `check-db` falla (autenticación)

Tu `.env` debe coincidir con el usuario de la base. En `.env.example` viene:

| Variable | Valor |
|----------|--------|
| DB_USER | inscripciones |
| DB_PASSWORD | inscripciones |
| DB_NAME | escuela_inscripciones |

**PostgreSQL local (Ubuntu):** creá usuario y base:

```bash
sudo -u postgres psql -f backend/scripts/init-db.sql
sudo -u postgres psql -d escuela_inscripciones -f backend/schema/schema.sql
```

Si la base ya existía sin tablas nuevas:

```bash
sudo -u postgres psql -d escuela_inscripciones -f backend/schema/migrations/002_flujo_inscripcion.sql
```

## 3. Usuarios de prueba

| Cédula | Contraseña | Rol   |
|--------|------------|-------|
| 1010   | 123        | Admin |
| 2020   | 123        | User  |

## 4. Uso desde el celular

Con el backend en marcha, abrí en el teléfono (misma red Wi‑Fi o servidor publicado):

- `http://TU_SERVIDOR:3000/login/login.html?form=register`
- O la página principal: `http://TU_SERVIDOR:3000/`

## 5. Flujo de inscripción (estados)

| Estado       | Descripción                          |
|-------------|--------------------------------------|
| `pendiente` | Recién creada                        |
| `en_revision` | Admin está revisando             |
| `aprobada`  | Inscripción confirmada               |
| `rechazada` | Rechazada (ver observaciones)        |

El historial queda en la tabla `inscripcion_historial`.

## Estructura del proyecto

```
backend/
  index.js          # API REST
  db.js             # Pool PostgreSQL
  schema/           # SQL inicial y migraciones
frontend/
  m/                # Formulario móvil (opcional)
  login/            # Login y registro
  user/             # Panel usuario
  admin/            # Panel admin
```

## API relevante

- `POST /login`, `POST /usuarios`
- `POST /inscripciones`, `GET /inscripciones/usuario`
- `PATCH /inscripciones/:id/estado` (admin)
- `GET /inscripciones/:id/historial`
- `POST /contactos`
