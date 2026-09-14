# Checklist — requisitos de la materia

Proyecto: **Sistema de inscripciones** · Escuela básica nacional la cuadra de Bolivar

---

## Estado general

| Requisito | ¿Lo tenemos? | Dónde está |
|-----------|--------------|------------|
| **Cliente y servidor separados** | ✅ Sí | `frontend/` (cliente) + `backend/` (servidor) |
| **Tecnología definida** | ✅ Sí | Node.js, Express, PostgreSQL, HTML/CSS/JS |
| **Base de datos PostgreSQL** | ✅ Sí | `backend/schema/schema.sql`, pgAdmin |
| **Sistema en ejecución** | ✅ Sí | `npm start` → http://localhost:3000 |
| **Seguridad RBAC por roles** | ✅ Sí | Tablas + `backend/middleware/rbac.js` + [SEGURIDAD-RBAC.md](SEGURIDAD-RBAC.md) |
| **Diagrama entidad-relación** | ✅ Sí | [DIAGRAMA-ER.md](DIAGRAMA-ER.md) |
| **Flujo de datos en BD** | ✅ Sí | Inscripciones, estados, historial |
| **Uso en celular** | ✅ Sí | Web responsive, sin app nativa |

---

## 1. Cliente y servidor

```
┌─────────────────┐         HTTP/JSON          ┌─────────────────┐         SQL          ┌──────────────┐
│    CLIENTE      │  ───────────────────────►  │    SERVIDOR     │  ───────────────►  │  PostgreSQL  │
│  frontend/      │                            │  backend/       │                      │  pgAdmin     │
│  HTML CSS JS    │  ◄───────────────────────  │  Node + Express │  ◄───────────────  │              │
└─────────────────┘                            └─────────────────┘                      └──────────────┘
```

- **Cliente:** navegador (PC o teléfono) muestra pantallas y envía formularios.
- **Servidor:** API REST guarda y lee en la base de datos.

---

## 2. Seguridad informática — RBAC (Jaider)

| Elemento | Implementación |
|----------|----------------|
| Roles | `roles` → admin, user |
| Usuarios con rol | `usuarios.rol_id` |
| Módulos | `modulos` (Inscripciones, Administración) |
| Permisos CRUD | `permisos` (crear, leer, editar, borrar) |
| Control en API | Middleware rechaza con **403** si no hay permiso |
| Control en pantallas | Admin vs panel usuario según `rol_id` |

Documento: [SEGURIDAD-RBAC.md](SEGURIDAD-RBAC.md)

---

## 3. Tecnologías (para decir en clase)

| Capa | Tecnología |
|------|------------|
| Cliente | HTML5, CSS3, JavaScript |
| Servidor | Node.js 18+, Express 5 |
| Base de datos | PostgreSQL 14+ |
| Herramienta BD | pgAdmin 4 |
| Control de versiones | Git / GitHub (opcional) |

---

## 4. Sistema en ejecución (demostración)

Antes de la asesoría, probar en la laptop:

```bash
# Terminal 1 — verificar base
cd backend
npm run check-db

# Terminal 2 — servidor
npm start
```

Abrir en el navegador:
- http://localhost:3000/
- Login / registro / panel usuario / panel admin
- pgAdmin con tablas con datos

---

## 5. Laptop — qué llevar la semana que viene

- [ ] Laptop con el proyecto en `App-inscripciones`
- [ ] PostgreSQL corriendo + pgAdmin abierto
- [ ] `npm start` funcionando
- [ ] Usuario admin creado (o query para promover admin)
- [ ] Diagrama ER impreso o en PDF ([DIAGRAMA-ER.md](DIAGRAMA-ER.md))
- [ ] Este checklist o README

---

## 6. Lo que podrías mejorar (opcional, no obligatorio)

- [ ] Contraseñas hasheadas (bcrypt) — hoy van en texto plano (decirlo si preguntan)
- [ ] Desplegar en internet (Render, Railway) — hoy es local
- [ ] Documento PDF del informe final con capturas de pantalla

---

## Archivos clave del repo

```
App-inscripciones/
├── frontend/          ← CLIENTE
├── backend/           ← SERVIDOR
│   ├── index.js
│   ├── middleware/rbac.js
│   └── schema/schema.sql
├── docs/
│   ├── CHECKLIST-MATERIA.md    ← este archivo
│   ├── DIAGRAMA-ER.md          ← diagrama relación
│   ├── SEGURIDAD-RBAC.md       ← seguridad Jaider
│   └── PASO-A-PASO-PGADMIN.md
└── README.md
```
