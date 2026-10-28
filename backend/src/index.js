import 'dotenv/config';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db, initDb, pruneMissing } from './db.js';
import { createBot, THUMBS_DIR, UPLOADS_DIR } from './bot.js';
import { createServer } from './server.js';

const { BOT_TOKEN, PORT = 3000 } = process.env;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не задано у .env');
  process.exit(1);
}

await fs.mkdir(UPLOADS_DIR, { recursive: true });
await fs.mkdir(THUMBS_DIR, { recursive: true });
await initDb();
const pruned = await pruneMissing((f) => existsSync(path.join(UPLOADS_DIR, f)));
if (pruned.length) console.log(`🧹 Прибрав ${pruned.length} малюнків без файлу: #${pruned.join(', #')}`);

// Express 5 викликає цей колбек і при помилці — тому перевіряємо err
const server = createServer().listen(PORT, (err) => {
  if (!err) return console.log(`🌐 API: http://localhost:${PORT}`);
  if (err.code === 'EADDRINUSE') console.error(`❌ Порт ${PORT} зайнятий — бек уже запущений в іншому терміналі? Зупини його.`);
  else console.error(err);
  process.exit(1);
});

const bot = createBot(BOT_TOKEN);
await bot.telegram
  .setMyCommands([
    { command: 'kids', description: 'Список дітей' },
    { command: 'add', description: 'Додати дитину' },
    { command: 'logout', description: 'Вийти' },
  ])
  .catch((e) => console.error('Не вдалося встановити команди:', e.message));
bot.launch(() => console.log('🤖 Бот запущено'));

const shutdown = async (signal) => {
  // страховка: що б не тримало процес (keep-alive з'єднання тощо) — виходимо за 3 с
  setTimeout(() => process.exit(0), 3000).unref();
  bot.stop(signal);
  server.close();
  server.closeAllConnections();
  await db.destroy();
  process.exit(0);
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
