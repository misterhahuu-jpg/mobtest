import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

export async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('DB schema ready');
}

export async function getOrCreateUser(tgId, username) {
  const existing = await pool.query('SELECT * FROM users WHERE tg_id = $1', [tgId]);
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await pool.query(
    'INSERT INTO users (tg_id, username) VALUES ($1, $2) RETURNING *',
    [tgId, username]
  );
  return inserted.rows[0];
}

export async function claimTask(userId, taskRef, rewardAmount = 10) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fails silently (no row) if this task_ref was already claimed by this user
    const inserted = await client.query(
      `INSERT INTO task_claims (user_id, task_ref, reward_amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, task_ref) DO NOTHING
       RETURNING *`,
      [userId, taskRef, rewardAmount]
    );

    if (inserted.rows.length === 0) {
      await client.query('ROLLBACK');
      return { claimed: false };
    }

    const updated = await client.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [rewardAmount, userId]
    );

    await client.query('COMMIT');
    return { claimed: true, balance: updated.rows[0].balance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
