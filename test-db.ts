import postgres from 'https://deno.land/x/postgresjs@v3.3.5/mod.js';

const DATABASE_URL = Deno.env.get('DATABASE_URL');
if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    Deno.exit(1);
}

const sql = postgres(DATABASE_URL);

try {
    const result = await sql`SELECT 1 as test`;
    console.log('Database connection successful:', result[0]);
    await sql.end();
    Deno.exit(0);
} catch (error) {
    console.error('Database connection failed:', error.message);
    Deno.exit(1);
}