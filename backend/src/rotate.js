// Поворот малюнка, який сфотографували боком:  npm run rotate -- <id> <90|180|270>
// 90 — за годинниковою стрілкою, 270 — проти. Номер малюнка (#id) видно в боті
import 'dotenv/config';
import { db } from './db.js';
import { rotateDrawing } from './bot.js';

const [id, angle] = process.argv.slice(2).map(Number);
if (!id || ![90, 180, 270].includes(angle)) {
  console.error('Використання: npm run rotate -- <id> <90|180|270>');
  process.exit(1);
}

try {
  const row = await rotateDrawing(id, angle);
  if (!row) throw new Error(`Малюнка #${id} немає`);
  console.log(`🔄 #${id} повернуто на ${angle}° → ${row.filename}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
