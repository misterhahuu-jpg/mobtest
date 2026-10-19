# Telegram Task Mini App

Users complete tasks (join channel / bot / group / mini app) surfaced by AdsGram's
Task ad unit and earn in-app balance. No advertisers to source yourself — AdsGram
supplies the offers.

## Stack
- Frontend: React + Vite, served as static files
- Backend: Express API + Telegraf bot, one Node process
- DB: Postgres (Railway plugin)
- Tasks: AdsGram Task block (`<adsgram-task>` web component)

## 1. Create the bot
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → save the token.
2. `/newapp` (or Bot Settings → Mini App) to register your Mini App and its URL
   (you'll set this after deploying to Railway).

## 2. Create the AdsGram Task block
1. Sign up at https://partner.adsgram.ai
2. Create one block with type **Task** — copy its id (`task-xxx`).
3. Only one Task block is allowed per app.

## 3. Deploy to Railway
1. Push this repo to GitHub, then in Railway: **New Project → Deploy from GitHub repo**.
2. **Add a Postgres plugin** to the project — Railway sets `DATABASE_URL` automatically.
3. In the app service's **Variables**, set:
   - `BOT_TOKEN` — from BotFather
   - `WEBAPP_URL` — the Railway-assigned public URL for this service (e.g.
     `https://tg-task-app-production.up.railway.app`) — set this *after* the first
     deploy once Railway gives you the domain, then redeploy
   - `TASK_REWARD` — points per task (default 10)
   - `VITE_ADSGRAM_BLOCK_ID` — your `task-xxx` id from AdsGram
4. Railway builds with `npm install && npm run build` (creates `dist/`) and starts
   with `npm start`, which runs the Express server, serves `dist/`, and sets the
   bot's webhook to `WEBAPP_URL/telegraf`.
5. In BotFather, set the Mini App URL to your `WEBAPP_URL`.

## 4. Local development
```bash
cp .env.example .env
# fill in BOT_TOKEN and a local/dev DATABASE_URL, leave WEBAPP_URL empty
npm install
npm run build      # or `npm run dev:client` in a second terminal for hot reload
npm run dev:server
```
With `WEBAPP_URL` empty, the bot runs in polling mode locally instead of webhook mode.

## How claiming works
1. Mini app sends Telegram `initData` to `/api/auth` on load — backend verifies
   the HMAC signature (per Telegram's spec) and creates/loads the user row.
2. The AdsGram `<adsgram-task>` widget shows the current task and fires a
   `reward` event when the user completes it.
3. Frontend calls `/api/claim` with the task reference — backend re-verifies
   `initData` and inserts into `task_claims`, which has a unique constraint on
   `(user_id, task_ref)` so the same task can't be claimed twice.
4. Balance updates atomically in the same transaction.

## Next steps to harden before real users
- Confirm with AdsGram whether Task blocks support a server-side postback/webhook
  as a second source of truth (don't rely on the client-side `reward` event alone
  once volume grows).
- Add a `/api/withdraw` flow (TON Connect or Telegram Stars, depending on payout method).
- Add per-user rate limiting on `/api/claim`.
