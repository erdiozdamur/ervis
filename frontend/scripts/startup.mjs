const REQUIRED_ENV = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const OPTIONAL_ENV = ['NEXTAUTH_URL', 'ADMIN_EMAIL'];

function reportVars(label, keys) {
  for (const key of keys) {
    const present = Boolean(process.env[key] && process.env[key].trim().length > 0);
    console.log(`[startup] ${label} env ${key}: ${present ? 'present' : 'missing'}`);
  }
}

const missingRequired = REQUIRED_ENV.filter((key) => !process.env[key] || process.env[key].trim().length === 0);

console.log(`[startup] command: node ./scripts/startup.mjs && next start -H 0.0.0.0 -p 3000`);
console.log(`[startup] cwd: ${process.cwd()}`);
console.log(`[startup] port: ${process.env.PORT ?? '3000'} (Next.js is started on 3000 explicitly)`);
console.log(`[startup] next binary: ${process.cwd()}/node_modules/.bin/next`);
reportVars('required', REQUIRED_ENV);
reportVars('optional', OPTIONAL_ENV);

if (missingRequired.length > 0) {
  console.error(`[startup] Missing required environment variable(s): ${missingRequired.join(', ')}`);
  process.exit(1);
}
