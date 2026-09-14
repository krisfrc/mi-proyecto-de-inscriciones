# Diagrama entidad-relación (ER)

Base de datos: `escuela_inscripciones` · PostgreSQL

## Diagrama (para informe o presentación)

```mermaid
erDiagram
    roles ||--o{ usuarios : tiene
    roles ||--o{ rm_pagin : accede
    modulos ||--o{ rm_pagin : incluye
    rm_pagin ||--|| permisos : define

    usuarios ||--o{ direcciones : registra
    usuarios ||--o{ estudiantes : tiene
    usuarios ||--o{ inscripciones : solicita
    usuarios ||--o{ inscripcion_historial : modifica

    estudiantes ||--o| inscripciones : inscribe
    inscripciones ||--o{ inscripcion_historial : historial

    roles {
        int id PK
        string nombre UK
    }

    usuarios {
        int id PK
        string nombre
        string apellido
        string cedula UK
        string contraseña
        int rol_id FK
    }

    direcciones {
        int id PK
        string calle
        string av
        string barrio
        string n_casa
        string parroquia
        string municipio
        string estado
        int id_user FK
    }

    modulos {
        int id PK
        string nombre
    }

    rm_pagin {
        int id PK
        int rol_id FK
        int modulo_id FK
        string pagina
    }

    permisos {
        int id PK
        int id_rm_pagin FK
        bool puede_crear
        bool puede_leer
        bool puede_editar
        bool puede_borrar
    }

    estudiantes {
        int id PK
        string nombre
        string grado
        int usuario_id FK
    }

    inscripciones {
        int id PK
        int usuario_id FK
        int estudiante_id FK UK
        timestamp fecha
        string estado
        string observaciones
    }

    inscripcion_historial {
        int id PK
        int inscripcion_id FK
        string estado_anterior
        string estado_nuevo
        int usuario_id FK
        string nota
        timestamp creado_en
    }

    contactos {
        int id PK
        string nombre
        string email
        string mensaje
        timestamp creado_en
    }
```

## Cómo verlo en pgAdmin

1. **escuela_inscripciones** → clic derecho → **ERD For Database** (si tu versión de pgAdmin lo tiene).
2. O **Query Tool** → pegar el SQL de `backend/schema/schema.sql` y revisar tablas en **Schemas → public → Tables**.

## Tablas resumidas

| Tabla | Descripción |
|-------|-------------|
| `roles` | admin, user |
| `usuarios` | Login y rol |
| `direcciones` | Domicilio (barrio, parroquia, municipio, estado) |
| `modulos` | Módulos del sistema |
| `rm_pagin` | Rol ↔ módulo ↔ página |
| `permisos` | CRUD por rol (RBAC) |
| `estudiantes` | Alumnos por familia |
| `inscripciones` | Solicitud + estado |
| `inscripcion_historial` | Flujo de estados |
| `contactos` | Mensajes del formulario web |
