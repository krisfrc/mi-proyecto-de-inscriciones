require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const MIGRATIONS = [
    '002_flujo_inscripcion.sql',
    '003_direccion_venezuela.sql',
    '004_permisos_por_rol.sql',
    '005_operatividad_inscripciones.sql',
    '006_configuracion_institucion_docentes.sql',
    '007_documentos_requeridos_y_seguridad.sql',
    '008_preescolar_logo_docentes.sql',
];

const run = async () => {
    for (const file of MIGRATIONS) {
        const fullPath = path.join(__dirname, '..', 'schema', 'migrations', file);
        if (!fs.existsSync(fullPath)) continue;
        const sql = fs.readFileSync(fullPath, 'utf8');
        console.log(`Ejecutando ${file}...`);
        try {
            await pool.query(sql);
            console.log(`  OK`);
        } catch (err) {
            if (err.message.includes('already exists') || err.message.includes('does not exist')) {
                console.log(`  Omitido (${err.message})`);
            } else {
                console.error(`  Error: ${err.message}`);
            }
        }
    }
    const cols = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'direcciones' ORDER BY ordinal_position`
    );
    console.log('\nColumnas en direcciones:', cols.rows.map((r) => r.column_name).join(', '));
    process.exit(0);
}

run().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
