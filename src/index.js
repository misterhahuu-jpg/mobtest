import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Telegraf } from 'telegraf';
import { migrate, getOrCreateUser, claimTask, pool } from './db.js';
import { verifyInitData } from './verifyInitData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL; // e.g. https://your-app.up.railway.app
const DEFAULT_REWARD = Number(process.env.TASK_REWARD || 10);

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN env var');
  process.exit(1);
}

const app = express();
app.use(express.json());

function requireUser(req, res) {
  const { initData } = req.body;
  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    res.status(401).json({ ok: false, error: 'invalid_session' });
    return null;
  }
  return user;
}

app.post('/api/auth', async (req, res) => {
  const tgUser = requireUser(req, res);
  if (!tgUser) return;

  const row = await getOrCreateUser(tgUser.id, tgUser.username || tgUser.first_name);
  res.json({ ok: true, balance: row.balance });
});

app.post('/api/claim', async (req, res) => {
  const tgUser = requireUser(req, res);
  if (!tgUser) return;

  const { taskRef } = req.body;
  if (!taskRef) return res.status(400).json({ ok: false, error: 'missing_task_ref' });

  const row = await getOrCreateUser(tgUser.id, tgUser.username || tgUser.first_name);
  const result = await claimTask(row.id, String(taskRef), DEFAULT_REWARD);

  if (!result.claimed) {
    const current = await pool.query('SELECT balance FROM users WHERE id = $1', [row.id]);
    return res.json({ ok: true, balance: current.rows[0].balance, alreadyClaimed: true });
  }

  res.json({ ok: true, balance: result.balance });
});

app.post('/api/balance', async (req, res) => {
  const tgUser = requireUser(req, res);
  if (!tgUser) return;
  const row = await getOrCreateUser(tgUser.id, tgUser.username || tgUser.first_name);
  res.json({ ok: true, balance: row.balance });
});

// Serve the built frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// --- Telegram bot ---
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('Welcome! Complete tasks to earn rewards.', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Open tasks', web_app: { url: WEBAPP_URL } }]]
    }
  });
});

async function start() {
  await migrate();

  if (WEBAPP_URL) {
    await bot.telegram.setWebhook(`${WEBAPP_URL}/telegraf`);
    app.use(bot.webhookCallback('/telegraf'));
    console.log('Bot running in webhook mode');
  } else {
    bot.launch();
    console.log('Bot running in polling mode (set WEBAPP_URL for webhook mode)');
  }

  app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
