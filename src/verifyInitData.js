import crypto from 'crypto';

/**
 * Verifies Telegram WebApp initData per the official spec:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns the parsed user object if valid, or null if invalid/expired.
 */
export function verifyInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  const authDate = Number(params.get('auth_date') || 0);
  if (Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}
