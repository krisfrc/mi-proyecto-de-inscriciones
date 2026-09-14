require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../db');

console.log('Comprobando conexión...');
console.log(`  Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
console.log(`  Usuario: ${process.env.DB_USER}`);
console.log(`  Base: ${process.env.DB_NAME}\n`);

pool.query('SELECT NOW() AS hora, current_database() AS base')
    .then((res) => {
        console.log('✅ PostgreSQL conectado correctamente');
        console.log('   Base:', res.rows[0].base);
        console.log('   Hora:', res.rows[0].hora);
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ No se pudo conectar:', err.message);
        console.error('\nRevisá backend/.env (copiá desde .env.example) y que PostgreSQL esté corriendo.');
        console.error('Guía: ver README.md sección "Poner en marcha"');
        process.exit(1);
    });
