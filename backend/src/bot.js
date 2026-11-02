import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Markup, Telegraf } from 'telegraf';
import {
  addDrawing,
  authorizeBotUser,
  childDrawingsPage,
  countChildDrawings,
  createChild,
  deleteChild,
  deleteDrawing,
  getBotUser,
  getChild,
  getDrawing,
  listChildren,
  logoutBotUser,
  renameChild,
  replaceDrawingFile,
  setCurrentChild,
} from './db.js';

export const UPLOADS_DIR = path.resolve('uploads');
export const THUMBS_DIR = path.resolve('thumbs');

// Пароль для керування галереєю через бота
const PASSWORD = '77777';

const PER_PAGE = 10;

const displayName = (u) =>
  u.username ? `@${u.username}` : [u.first_name, u.last_name].filter(Boolean).join(' ');

const fmtDate = (d) => new Date(d).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' });

// Посилання на сайт — лише якщо адреса публічна (Telegram не приймає localhost у кнопках)
const siteUrl = () => {
  const url = process.env.PUBLIC_URL || '';
  return /^https?:\/\/(?!localhost|127\.)/.test(url) ? url : '';
};

// Розміри з урахуванням EXIF-повороту (фото з телефона часто лежать "боком")
const orientedSize = (m) => (m.orientation >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height });

export async function removeFiles(filenames) {
  await Promise.all(
    filenames.flatMap((f) => [
      fs.rm(path.join(UPLOADS_DIR, f), { force: true }),
      fs.rm(path.join(THUMBS_DIR, f + '.webp'), { force: true }),
    ])
  );
}

async function download(ctx, fileId, filename) {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  await fs.writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(await res.arrayBuffer()));
}

// ---------- Клавіатури ----------

async function kidsKeyboard() {
  const kids = await listChildren();
  const rows = kids.map((k) => [Markup.button.callback(`👧 ${k.name} (${k.drawings})`, `kid:${k.id}`)]);
  rows.push([Markup.button.callback('➕ Нова дитина', 'newkid')]);
  if (siteUrl()) rows.push([Markup.button.url('🌐 Відкрити сайт', siteUrl())]);
  return { text: kids.length ? '👧 Діти — обери, кому додавати малюнки:' : 'Дітей ще немає. Додай першу дитину 👇', kb: Markup.inlineKeyboard(rows) };
}

const kidKeyboard = (id) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🖼 Малюнки', `draws:${id}:0`)],
    [Markup.button.callback('✏️ Перейменувати', `renkid:${id}`)],
    [Markup.button.callback('❌ Видалити дитину', `delkid:${id}`)],
    [Markup.button.callback('◀ До списку дітей', 'kids')],
  ]);

async function showKids(ctx, edit = false) {
  const { text, kb } = await kidsKeyboard();
  if (edit) return ctx.editMessageText(text, kb).catch(() => ctx.reply(text, kb));
  return ctx.reply(text, kb);
}

async function openKid(ctx, id, edit = false) {
  const kid = await getChild(id);
  if (!kid) return showKids(ctx, edit);
  await setCurrentChild(ctx.from.id, kid.id);
  const n = await countChildDrawings(kid.id);
  const text = `👧 ${kid.name} — малюнків: ${n}\n\n📸 Надсилай фото — вони додаватимуться до ${kid.name}.`;
  if (edit) return ctx.editMessageText(text, kidKeyboard(kid.id)).catch(() => ctx.reply(text, kidKeyboard(kid.id)));
  return ctx.reply(text, kidKeyboard(kid.id));
}

// ---------- Малюнки дитини в чаті: альбом + кнопки видалення ----------

const shownPages = new Map(); // chatId -> id повідомлень поточної сторінки, щоб прибрати їх при гортанні

async function clearShown(ctx) {
  const old = shownPages.get(ctx.chat.id);
  shownPages.delete(ctx.chat.id);
  if (old) await Promise.all(old.map((id) => ctx.telegram.deleteMessage(ctx.chat.id, id).catch(() => {})));
}

async function sendDrawingsPage(ctx, childId, page) {
  const kid = await getChild(childId);
  if (!kid) return showKids(ctx);
  const total = await countChildDrawings(childId);
  if (!total) await clearShown(ctx);
  if (!total) return ctx.reply(`У ${kid.name} ще немає малюнків. Надішли фото 📸`, kidKeyboard(childId));

  const pages = Math.ceil(total / PER_PAGE);
  page = Math.min(Math.max(page, 0), pages - 1);
  const drawings = await childDrawingsPage(childId, page, PER_PAGE);
  await clearShown(ctx);

  const chatId = ctx.chat.id;
  const media = drawings.map((d) => ({
    type: 'photo',
    media: d.file_id || { source: path.join(UPLOADS_DIR, d.filename) },
    caption: `#${d.id} · ${fmtDate(d.created_at)}`,
  }));
  // Альбом у Telegram — від 2 фото, одне надсилаємо звичайним повідомленням
  const album =
    media.length === 1
      ? [await ctx.telegram.sendPhoto(chatId, media[0].media, { caption: media[0].caption })]
      : await ctx.telegram.sendMediaGroup(chatId, media);

  // По два малюнки в рядку: 🗑 #N | 🔄 #N
  const rows = [];
  for (let i = 0; i < drawings.length; i += 2) {
    rows.push(
      drawings.slice(i, i + 2).flatMap((d) => [
        Markup.button.callback(`🗑 #${d.id}`, `deldraw:${d.id}:${childId}:${page}`),
        Markup.button.callback(`🔄 #${d.id}`, `open:${d.id}`),
      ])
    );
  }
  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('◀ Новіші', `draws:${childId}:${page - 1}`));
  if (page < pages - 1) nav.push(Markup.button.callback('Старіші ▶', `draws:${childId}:${page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([Markup.button.callback(`◀ До ${kid.name}`, `kid:${childId}`)]);

  const info = await ctx.reply(
    `🖼 ${kid.name}: сторінка ${page + 1} з ${pages} · всього ${total}\n🗑 — видалити малюнок, 🔄 — відкрити й повернути.`,
    Markup.inlineKeyboard(rows)
  );
  shownPages.set(chatId, [...album.map((m) => m.message_id), info.message_id]);
}

// ---------- Збереження фото ----------

// Сайт показує JPEG/PNG/WebP — решту (GIF, BMP, TIFF, AVIF…) перетворюємо в JPEG
const WEB_EXT = /^\.(jpe?g|png|webp)$/;

async function toJpeg(filename) {
  const src = path.join(UPLOADS_DIR, filename);
  const out = filename.replace(/\.[^.]*$/, '') + '.jpg';
  try {
    await sharp(src).rotate().flatten({ background: '#fff' }).jpeg({ quality: 90 }).toFile(path.join(UPLOADS_DIR, out));
    return out;
  } catch {
    return null;
  } finally {
    await fs.rm(src, { force: true });
  }
}

// Поворот малюнка, який сфотографували боком (angle: 90 — за годинниковою, 270 — проти).
// Пишемо новий файл з новим ім'ям — щоб браузери не показували старе прев'ю з кешу
export async function rotateDrawing(id, angle) {
  const d = await getDrawing(id);
  if (!d) return null;
  const filename = `${d.filename.replace(/(_r\d+)?\.[^.]*$/, '')}_r${Date.now()}.jpg`;
  const info = await sharp(path.join(UPLOADS_DIR, d.filename))
    .rotate() // спершу EXIF
    .rotate(angle)
    .jpeg({ quality: 90 })
    .toFile(path.join(UPLOADS_DIR, filename));
  const row = await replaceDrawingFile(id, { filename, width: info.width, height: info.height });
  await removeFiles([d.filename]);
  return row;
}

const drawingKeyboard = (id, kid) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('↺ Повернути', `rot:${id}:270`), Markup.button.callback('Повернути ↻', `rot:${id}:90`)],
    [Markup.button.callback('🗑 Видалити цей малюнок', `deldraw:${id}`)],
    [Markup.button.callback(`👧 ${kid.name}`, `kid:${kid.id}`), Markup.button.callback('👧 Інша дитина', 'kids')],
  ]);

async function saveDrawing(ctx, { fileId, fileUniqueId, ext, width, height }) {
  const user = await getBotUser(ctx.from.id);
  const kid = user?.current_child_id && (await getChild(user.current_child_id));
  if (!kid) {
    const { kb } = await kidsKeyboard();
    return ctx.reply('Спершу обери дитину, якій додати малюнок 👇', kb);
  }

  let filename = `${fileUniqueId}${ext}`;
  await download(ctx, fileId, filename);
  if (!WEB_EXT.test(ext)) {
    filename = await toJpeg(filename);
    if (!filename) return ctx.reply('Не вдалося прочитати це зображення 😕 Надішли його звичайним фото (не файлом).');
  }
  if (!width || !height) {
    try {
      ({ width, height } = orientedSize(await sharp(path.join(UPLOADS_DIR, filename)).metadata()));
    } catch {
      await removeFiles([filename]);
      return ctx.reply('Не вдалося прочитати це зображення 😕 Надішли його звичайним фото (не файлом).');
    }
  }
  const row = await addDrawing({ childId: kid.id, fileUniqueId, fileId, filename, width, height });
  if (!row) return ctx.reply('Цей малюнок уже є в галереї 🙂');

  return ctx.reply(`✅ Додано до ${kid.name} (#${row.id})\nЛежить боком? Поверни кнопками ↺ ↻`, drawingKeyboard(row.id, kid));
}

// ---------- Бот ----------

// userId → від кого чекаємо ім'я: null — нова дитина, id — перейменування цієї дитини
const awaitingName = new Map();

export function createBot(token) {
  const bot = new Telegraf(token);

  // Усе, крім введення пароля, — лише для тих, хто його ввів
  bot.use(async (ctx, next) => {
    if (!ctx.from) return;
    if (await getBotUser(ctx.from.id)) return next();

    const text = ctx.message?.text?.trim();
    if (text === PASSWORD) {
      await authorizeBotUser(ctx.from.id, displayName(ctx.from));
      await ctx.deleteMessage().catch(() => {}); // прибираємо пароль з чату
      await ctx.reply('🔓 Доступ надано!');
      return showKids(ctx);
    }
    if (ctx.callbackQuery) await ctx.answerCbQuery('🔒 Спершу введи пароль').catch(() => {});
    return ctx.reply('🔒 Введи пароль, щоб керувати галереєю:');
  });

  bot.start(async (ctx) => {
    await ctx.reply(
      '🎨 Галерея дитячих малюнків\n\n' +
        '1. Обери дитину (або створи нову)\n' +
        '2. Надсилай фото малюнків — вони з’являться на сайті\n\n' +
        '/kids — список дітей\n' +
        '/add Ім’я — додати дитину\n' +
        '/logout — вийти'
    );
    return showKids(ctx);
  });

  bot.command('kids', (ctx) => showKids(ctx));

  bot.command('add', async (ctx) => {
    const name = ctx.payload.trim();
    if (!name) {
      awaitingName.set(ctx.from.id, null);
      return ctx.reply('Напиши ім’я дитини:');
    }
    const kid = await createChild(name);
    return openKid(ctx, kid.id);
  });

  bot.command('logout', async (ctx) => {
    await logoutBotUser(ctx.from.id);
    return ctx.reply('👋 Вийшов. Щоб повернутися — введи пароль.');
  });

  bot.action('kids', async (ctx) => {
    await ctx.answerCbQuery();
    return showKids(ctx, true);
  });

  bot.action('newkid', async (ctx) => {
    await ctx.answerCbQuery();
    awaitingName.set(ctx.from.id, null);
    return ctx.reply('Напиши ім’я дитини:');
  });

  bot.action(/^kid:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    return openKid(ctx, Number(ctx.match[1]), true);
  });

  bot.action(/^draws:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    return sendDrawingsPage(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
  });

  bot.action(/^renkid:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const kid = await getChild(Number(ctx.match[1]));
    if (!kid) return showKids(ctx, true);
    awaitingName.set(ctx.from.id, kid.id);
    return ctx.reply(`Напиши нове ім’я для ${kid.name}:`);
  });

  bot.action(/^delkid:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const kid = await getChild(Number(ctx.match[1]));
    if (!kid) return showKids(ctx, true);
    const n = await countChildDrawings(kid.id);
    return ctx.editMessageText(
      `Видалити ${kid.name} разом з усіма малюнками (${n})? Це не можна скасувати.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Так, видалити', `delkid!:${kid.id}`)],
        [Markup.button.callback('Скасувати', `kid:${kid.id}`)],
      ])
    );
  });

  bot.action(/^delkid!:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const files = await deleteChild(Number(ctx.match[1]));
    if (files) await removeFiles(files);
    await ctx.editMessageText('🗑 Дитину видалено.').catch(() => {});
    return showKids(ctx);
  });

  // Видалення малюнка — спершу питаємо окремим повідомленням.
  // deldraw:id — з малюнка/повідомлення «Додано»; deldraw:id:childId:page — зі сторінки малюнків
  bot.action(/^deldraw:(\d+)(?::(\d+):(\d+))?$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, id, childId, page] = ctx.match;
    // Після видалення: оновити сторінку малюнків або прибрати повідомлення, з якого видаляли
    const then = childId ? `${childId}:${page}` : `m${ctx.callbackQuery.message.message_id}`;
    return ctx.reply(
      `Видалити малюнок #${id}? Це не можна скасувати.`,
      Markup.inlineKeyboard([[Markup.button.callback('🗑 Так, видалити', `deldraw!:${id}:${then}`), Markup.button.callback('Скасувати', 'delcancel')]])
    );
  });

  bot.action(/^deldraw!:(\d+):(?:m(\d+)|(\d+):(\d+))$/, async (ctx) => {
    const [, id, sourceMsg, childId, page] = ctx.match;
    const removed = await deleteDrawing(Number(id));
    if (removed) await removeFiles([removed.filename]);
    await ctx.answerCbQuery(removed ? `🗑 Малюнок #${id} видалено` : 'Його вже видалено');
    await ctx.deleteMessage().catch(() => {});
    if (childId) return sendDrawingsPage(ctx, Number(childId), Number(page));
    await ctx.telegram.deleteMessage(ctx.chat.id, Number(sourceMsg)).catch(() => {});
    return ctx.reply(`🗑 Малюнок #${id} видалено.`);
  });

  bot.action('delcancel', async (ctx) => {
    await ctx.answerCbQuery('Скасовано');
    return ctx.deleteMessage().catch(() => {});
  });

  // Окремий малюнок зі сторінки малюнків — з кнопками повороту й видалення
  bot.action(/^open:(\d+)$/, async (ctx) => {
    const d = await getDrawing(Number(ctx.match[1]));
    await ctx.answerCbQuery(d ? '' : 'Малюнок уже видалено');
    if (!d) return;
    const kid = await getChild(d.child_id);
    return ctx.replyWithPhoto(d.file_id || { source: path.join(UPLOADS_DIR, d.filename) }, {
      caption: `🖼 ${kid.name} (#${d.id})`,
      ...drawingKeyboard(d.id, kid),
    });
  });

  bot.action(/^rot:(\d+):(90|270)$/, async (ctx) => {
    const row = await rotateDrawing(Number(ctx.match[1]), Number(ctx.match[2]));
    await ctx.answerCbQuery(row ? '🔄 Повернуто' : 'Малюнок уже видалено');
    if (!row) return;

    // Показуємо результат: якщо це текст «Додано» — замінюємо його фото, якщо вже фото — міняємо картинку
    const kid = await getChild(row.child_id);
    const photo = { source: path.join(UPLOADS_DIR, row.filename) };
    const caption = `🔄 ${kid.name} (#${row.id})`;
    const kb = drawingKeyboard(row.id, kid);
    if (ctx.callbackQuery.message?.photo) return ctx.editMessageMedia({ type: 'photo', media: photo, caption }, kb);
    await ctx.deleteMessage().catch(() => {});
    return ctx.replyWithPhoto(photo, { caption, ...kb });
  });

  bot.on('text', async (ctx) => {
    if (!awaitingName.has(ctx.from.id)) return showKids(ctx);
    const renameId = awaitingName.get(ctx.from.id);
    awaitingName.delete(ctx.from.id);
    const name = ctx.message.text.trim().slice(0, 100);
    if (renameId) {
      const kid = await renameChild(renameId, name);
      if (!kid) return showKids(ctx);
      await ctx.reply(`✏️ Тепер це ${kid.name}`);
      return openKid(ctx, kid.id);
    }
    const kid = await createChild(name);
    return openKid(ctx, kid.id);
  });

  // Звичайне (стиснене) фото — беремо найбільший розмір
  bot.on('photo', (ctx) => {
    const p = ctx.message.photo.at(-1);
    return saveDrawing(ctx, {
      fileId: p.file_id,
      fileUniqueId: p.file_unique_id,
      ext: '.jpg',
      width: p.width,
      height: p.height,
    });
  });

  // Фото, надіслане "як файл" (без стиснення) — будь-яке зображення
  bot.on('document', (ctx) => {
    const d = ctx.message.document;
    const fileExt = path.extname(d.file_name || '').toLowerCase();
    if (!d.mime_type?.startsWith('image/') && !/^\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif)$/.test(fileExt)) {
      return ctx.reply('Надішли, будь ласка, зображення.');
    }
    if (d.file_size > 20 * 1024 * 1024) return ctx.reply('Файл завеликий (Telegram дає ботам до 20 МБ). Надішли звичайним фото.');
    const ext = /^\.[a-z0-9]{2,5}$/.test(fileExt) ? fileExt.replace('.jpeg', '.jpg') : `.${d.mime_type.split('/')[1]}`;
    return saveDrawing(ctx, { fileId: d.file_id, fileUniqueId: d.file_unique_id, ext });
  });

  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('⚠️ Щось пішло не так, спробуй ще раз.').catch(() => {});
  });

  return bot;
}
