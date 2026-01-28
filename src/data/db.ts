
// Workaround for Vite/Electron CJS Loading
let Pool: any;

if (typeof window !== 'undefined' && (window as any).require) {
    // Electron Environment
    try {
        const pg = (window as any).require('pg');
        Pool = pg.Pool;
    } catch (e) {
        console.error("Failed to require 'pg' in Electron:", e);
    }
} else {
    // Fallback / Browser / Build logic
    // If we mistakenly run this in browser, it will fail gracefully later.
    console.warn("Direct SQL Client requires Electron environment.");
    // Mock Pool to prevent build/init crash
    Pool = class MockPool {
        async query() { throw new Error("Database connection requires Electron environment."); }
        async connect() { throw new Error("Database connection requires Electron environment."); }
    };
}

// Using import.meta.env for Vite environment variables
const pool = new Pool({
    host: import.meta.env.VITE_PG_HOST || 'localhost',
    database: import.meta.env.VITE_PG_DATABASE || 'showroom_sales',
    user: import.meta.env.VITE_PG_USER || 'postgres',
    password: import.meta.env.VITE_PG_PASSWORD || '',
    port: parseInt(import.meta.env.VITE_PG_PORT || '5432'),
    ssl: import.meta.env.VITE_PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default pool;
