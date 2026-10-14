# Diagrama entidad-relación (ER)

Base de datos: `escuela_inscripciones` · PostgreSQL  
Modelo real del sistema (incluye migraciones 002–010).

## Diagrama

```mermaid
erDiagram
    roles ||--o{ usuarios : tiene
    roles ||--o{ rm_pagin : accede
    modulos ||--o{ rm_pagin : incluye
    rm_pagin ||--|| permisos : define

    usuarios ||--o{ direcciones : registra
    usuarios ||--o{ estudiantes : representa
    usuarios ||--o{ inscripciones : solicita
    usuarios ||--o{ inscripcion_historial : modifica
    usuarios ||--o{ avisos_colectivos : publica

    grados ||--o{ secciones : divide
    grados ||--o{ estudiantes : cursa
    secciones ||--o{ estudiantes : agrupa
    periodos_escolares ||--o{ inscripciones : corresponde

    estudiantes ||--o| inscripciones : inscribe
    inscripciones ||--o{ inscripcion_historial : historial
    inscripciones ||--o{ preinscripcion_documentos : adjunta
    documentos_tipos ||--o{ preinscripcion_documentos : clasifica

    roles { int id PK string nombre UK }
    usuarios { int id PK string nombre string apellido string cedula UK string email string contraseña int rol_id FK }
    direcciones { int id PK string calle string av string barrio string n_casa string parroquia string municipio string estado int id_user FK }
    estudiantes { int id PK string nombre string cedula string grado int grado_id FK int seccion_id FK int usuario_id FK date fecha_nacimiento string sexo string foto_url }
    grados { int id PK string nombre int orden }
    secciones { int id PK int grado_id FK string nombre int cupo }
    periodos_escolares { int id PK string nombre date fecha_inicio date fecha_fin bool activo }
    inscripciones { int id PK int usuario_id FK int estudiante_id FK UK int periodo_id FK string estado timestamp fecha }
    inscripcion_historial { int id PK int inscripcion_id FK string estado_anterior string estado_nuevo int usuario_id FK }
    preinscripcion_documentos { int id PK int inscripcion_id FK string nombre_archivo string ruta_archivo }
    documentos_tipos { int id PK string codigo UK string nombre bool obligatorio }
    docentes { int id PK string nombre string apellido string cedula UK string especialidad }
    institucion_config { int id PK string nombre string logo_url }
    contactos { int id PK string nombre string mensaje timestamp creado_en }
    avisos_colectivos { int id PK string titulo string mensaje int usuario_id FK timestamp creado_en }
    modulos { int id PK string nombre }
    rm_pagin { int id PK int rol_id FK int modulo_id FK string pagina }
    permisos { int id PK int id_rm_pagin FK bool puede_crear bool puede_leer bool puede_editar bool puede_borrar }
```

## Tablas (para el informe)

| Tabla | Qué guarda |
|-------|------------|
| `roles` / `usuarios` | Admin y representante (cédula, correo, clave) |
| `direcciones` | Domicilio del representante |
| `grados` / `secciones` / `periodos_escolares` | Catálogo académico: preescolar por salas, 1er/2do A-B, 3ro-6to solo A, cupo 40 |
| `estudiantes` | Alumnos del representante (foto y datos de personalización) |
| `inscripciones` | Preinscripción y estado |
| `inscripcion_historial` | Auditoría de estados |
| `preinscripcion_documentos` | PDF adjuntos |
| `docentes` | Profesores |
| `institucion_config` | Nombre y logo |
| `permisos` / `rm_pagin` | RBAC |
| `contactos` | Mensajes de la web |
| `avisos_colectivos` | Mensajes de la institución a todos los representantes |

En pgAdmin: clic derecho en `escuela_inscripciones` → **ERD For Database**.
