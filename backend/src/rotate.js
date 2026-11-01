// Поворот малюнка, який сфотографували боком:  npm run rotate -- <id> <90|180|270>
// 90 — за годинниковою стрілкою, 270 — проти. Номер малюнка (#id) видно в боті
import 'dotenv/config';
import path from 'node:path';
import sharp from 'sharp';
import { db } from './db.js';
import { removeFiles, UPLOADS_DIR } from './bot.js';

const [id, angle] = process.argv.slice(2).map(Number);
if (!id || ![90, 180, 270].includes(angle)) {
  console.error('Використання: npm run rotate -- <id> <90|180|270>');
  process.exit(1);
}

try {
  const d = await db('drawings').where({ id }).first();
  if (!d) throw new Error(`Малюнка #${id} немає`);

  // Нове ім'я файлу — щоб браузери не показували старе прев'ю з кешу
  const filename = `${d.filename.replace(/(_r\d+)?\.[^.]*$/, '')}_r${Date.now()}.jpg`;
  const info = await sharp(path.join(UPLOADS_DIR, d.filename))
    .rotate() // спершу EXIF
    .rotate(angle)
    .jpeg({ quality: 90 })
    .toFile(path.join(UPLOADS_DIR, filename));
  // file_id з Telegram уже не відповідає новому файлу — бот візьме його з диска
  await db('drawings').where({ id }).update({ filename, width: info.width, height: info.height, file_id: null });
  await removeFiles([d.filename]);
  console.log(`🔄 #${id} повернуто на ${angle}° → ${filename}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
