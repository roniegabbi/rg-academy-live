import { neon } from '@neondatabase/serverless';

let client = null;

// Cliente HTTP do Neon: cada consulta é uma requisição, sem conexões presas.
export function db() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}
