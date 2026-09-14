# Sistema de seguridad por roles (RBAC)

## Definición pedida

> *Sistema de seguridad informática que restringe el acceso a la red según el rol de cada usuario en una empresa.*

En este proyecto la **red** es el acceso a la **API web** (rutas HTTP del servidor). Cada usuario tiene un **rol** y solo puede usar los recursos que su rol permite.

## Cómo lo cumple este sistema

```
Usuario → Login (cédula + contraseña) → Rol en BD (admin / user)
                ↓
        Cada petición HTTP a la API
                ↓
        Middleware RBAC verifica rol + permisos
                ↓
        Permitido (200)  o  Denegado (403)
```

## Roles

| Rol | `rol_id` | Quién es | Acceso |
|-----|----------|----------|--------|
| **admin** | 1 | Personal de la escuela | Ver todas las inscripciones, cambiar estados, ver mensajes, borrar registros |
| **user** | 2 | Familia / representante | Solo sus estudiantes, direcciones e inscripciones |

## Tablas de seguridad (PostgreSQL)

| Tabla | Función |
|-------|---------|
| `roles` | Define los roles del sistema |
| `usuarios` | Cada persona con `rol_id` |
| `modulos` | Áreas del sistema (ej. Inscripciones) |
| `rm_pagin` | Qué rol accede a qué módulo/página |
| `permisos` | CRUD por rol: crear, leer, editar, borrar |

## Restricciones en la API

| Ruta | Rol requerido | Permiso |
|------|---------------|---------|
| `GET /admin/inscripciones` | admin | leer |
| `GET /admin/direcciones` | admin | leer |
| `GET /admin/contactos` | admin | leer |
| `PATCH /inscripciones/:id/estado` | admin | editar |
| `POST /inscripciones` | user o admin | crear (solo propios datos) |
| `GET /inscripciones/usuario` | user | leer (solo propios) |
| `DELETE /inscripciones/:id` | admin borra cualquiera; user solo los suyos | borrar |

## Restricciones en el frontend

- Tras el login, `rol_id === 1` → panel admin; `rol_id === 2` → panel usuario.
- Si un usuario normal abre `/admin/admin_dashboard.html`, el JS lo redirige al login.

## Código del middleware

Archivo: `backend/middleware/rbac.js`  
Se usa en `backend/index.js` en las rutas `/admin/*` y cambio de estado.

## Para el informe (texto sugerido)

*El sistema implementa **RBAC (Role-Based Access Control)**: el acceso a los recursos de la aplicación (equivalente al acceso en red de la organización) se controla según el rol asignado a cada usuario en la base de datos PostgreSQL. Los roles admin y user tienen permisos distintos definidos en las tablas `roles`, `modulos`, `rm_pagin` y `permisos`. El servidor rechaza con código HTTP 403 las operaciones no autorizadas.*

## Activar permisos en BD existente

```bash
cd backend
npm run migrate
```

O en pgAdmin ejecutar: `backend/schema/migrations/004_permisos_por_rol.sql`
