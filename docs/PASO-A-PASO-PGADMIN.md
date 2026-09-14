# Paso a paso — pgAdmin + base de datos funcionando

Sigue estos pasos en orden. Al final vas a ver las tablas en pgAdmin y la app va a guardar ahí.

---

## PARTE 1 — Crear usuario y base en pgAdmin

### 1. Abrí pgAdmin

En el panel izquierdo deberías ver algo como **Servers → PostgreSQL 14** (o 15, 16).

### 2. Conectate al servidor local

- Clic en **PostgreSQL 14** (o tu versión).
- Te pide contraseña: es la que pusiste al instalar PostgreSQL (usuario `postgres`).
- Si no la recordás, probá la que usás siempre para entrar a pgAdmin.

### 3. Abrí el Query Tool (consultas SQL)

- Clic derecho en la base **`postgres`** (no en el servidor, en la base `postgres`).
- **Query Tool** / **Herramienta de consultas**.

### 4. Crear usuario y base (¡una consulta cada vez!)

pgAdmin no permite `CREATE DATABASE` junto con otras líneas. Hacé **3 ejecuciones separadas** (F5 cada una):

**Consulta 1** — solo esto:
```sql
CREATE USER inscripciones WITH PASSWORD 'inscripciones';
```
(Si dice que ya existe, ignorá y seguí.)

**Consulta 2** — borrá lo anterior, pegá solo esto y F5:
```sql
CREATE DATABASE escuela_inscripciones OWNER inscripciones;
```

**Consulta 3** — borrá, pegá solo esto y F5:
```sql
GRANT ALL PRIVILEGES ON DATABASE escuela_inscripciones TO inscripciones;
```

**Alternativa sin SQL:** clic derecho en **Databases** → **Create** → **Database** → Name: `escuela_inscripciones`, Owner: `inscripciones` → Save.

**Si la base ya existe:** pasá al paso 5.

### 5. Refrescá el árbol

- Clic derecho en **Databases** → **Refresh**.
- Deberías ver **`escuela_inscripciones`**.

---

## PARTE 2 — Crear las tablas (schema)

### 6. Query Tool en la base nueva

- Clic derecho en **`escuela_inscripciones`** → **Query Tool**.

### 7. Cargar el archivo de tablas

En pgAdmin:

- Menú **File → Open** (Archivo → Abrir).
- Navegá a tu proyecto:
  `App-inscripciones/backend/schema/schema.sql`
- Abrí el archivo.

O copiá todo el contenido de ese archivo y pegalo en el Query Tool.

### 8. Ejecutar

- **▶ Execute** (F5).
- Abajo debe decir **Query returned successfully** (puede haber varios mensajes INSERT).

### 9. Verificar tablas

En el panel izquierdo:

`escuela_inscripciones → Schemas → public → Tables`

Deberías ver, entre otras:

- `usuarios`
- `estudiantes`
- `inscripciones`
- `inscripcion_historial`
- `direcciones`
- `contactos`
- `roles`

Clic derecho en `usuarios` → **View/Edit Data → All Rows** → deberían aparecer Admin y Facundo de prueba.

---

## PARTE 3 — Conectar la app (backend)

### 10. Archivo `.env`

En la carpeta `backend` del proyecto:

```bash
cd /home/francisco/Escritorio/App-inscripciones/backend
cp .env.example .env
```

Abrí `backend/.env` y confirmá que diga:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=inscripciones
DB_PASSWORD=inscripciones
DB_NAME=escuela_inscripciones
PUBLIC_URL=http://localhost:3000
```

**Importante:** `DB_USER` debe ser `inscripciones`, no `postgres`.

### 11. Probar conexión

En terminal:

```bash
cd /home/francisco/Escritorio/App-inscripciones/backend
npm install
npm run check-db
```

Tiene que mostrar: **✅ PostgreSQL conectado correctamente**

### 12. Arrancar el servidor

```bash
npm start
```

Debe decir:

- `PostgreSQL conectado`
- `Servidor en puerto 3000`

### 13. Probar en el navegador

- http://localhost:3000/
- Registrate o entrá con cédula **2020** / contraseña **123**

### 14. Ver los datos en pgAdmin

- Volvé a pgAdmin.
- Clic derecho en `inscripciones` → **View/Edit Data → All Rows** → **Refresh (F5)**.
- Ahí ves el flujo: filas nuevas y columna **`estado`**.

Para el historial de cambios: tabla **`inscripcion_historial`**.

---

## PARTE 4 — Segunda conexión en pgAdmin (opcional, recomendada)

Para no usar el usuario `postgres` cada vez:

1. Clic derecho en **Servers** → **Register → Server**.
2. **General → Name:** `Escuela Inscripciones`
3. **Connection:**
   - Host: `localhost`
   - Port: `5432`
   - Maintenance database: `escuela_inscripciones`
   - Username: `inscripciones`
   - Password: `inscripciones`
   - Guardar contraseña: sí
4. **Save**.

Trabajás siempre en esta conexión para ver el flujo del proyecto.

---

## Consulta útil — ver todo el flujo junto

Query Tool en `escuela_inscripciones`:

```sql
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
```

---

## Errores frecuentes

| Error | Solución |
|-------|----------|
| `password authentication failed for user "postgres"` en la app | Cambiá `DB_USER` a `inscripciones` en `.env` |
| `database "escuela_inscripciones" does not exist` | Repetí Parte 1 paso 4 |
| `relation "usuarios" does not exist` | Repetí Parte 2 (ejecutar `schema.sql`) |
| La app no guarda nada | ¿`npm start` corriendo? ¿`check-db` OK? |
| No veo filas nuevas | Refresh (F5) en View Data de la tabla |

---

## Actualizar direcciones (Venezuela: estado, municipio, parroquia)

Si la base ya existía, ejecutá una vez en Query Tool:

`backend/schema/migrations/003_direccion_venezuela.sql`

---

## Vaciar tablas y empezar de 0

En pgAdmin → **escuela_inscripciones** → **Query Tool**:

| Archivo | Qué hace |
|---------|----------|
| `backend/scripts/reset-database.sql` | Borra todo y deja solo admin (cédula **1010** / **123**) |
| `backend/scripts/reset-database-vacio.sql` | Borra todo; solo roles; registrás el primer usuario en la web |

Ejecutá **F5** después de abrir el archivo. Luego **Refresh** en las tablas (View Data).

---

## Usuarios de prueba

| Cédula | Contraseña | Rol |
|--------|------------|-----|
| 1010 | 123 | Admin |
| 2020 | 123 | Usuario |
