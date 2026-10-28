import knex from 'knex';
import config from '../knexfile.js';

export const db = knex(config);

// Дні рахуємо за київським часом, а не UTC — інакше малюнки після 21:00/22:00 потраплять у завтра
export const TZ = 'Europe/Kyiv';
const DAY = `(d.created_at at time zone '${TZ}')::date`;

// Схема — у migrations/, тут лише накочуємо нові міграції при старті
export async function initDb() {
  const [, applied] = await db.migrate.latest();
  if (applied.length) console.log(`🗄 Міграції: ${applied.join(', ')}`);
}

// ---------- Діти ----------

export async function createChild(name) {
  const [row] = await db('children').insert({ name }).returning('*');
  return row;
}

export const getChild = (id) => db('children').where({ id }).first();

export function listChildren() {
  return db('children as c')
    .leftJoin('drawings as d', 'd.child_id', 'c.id')
    .leftJoin('likes as l', 'l.drawing_id', 'd.id')
    .select(
      'c.id',
      'c.name',
      db.raw('count(distinct d.id)::int as drawings'),
      db.raw('count(l.drawing_id)::int as likes')
    )
    .groupBy('c.id')
    .orderBy('c.name');
}

// Повертає імена файлів малюнків — їх треба прибрати з диска
export async function deleteChild(id) {
  return db.transaction(async (trx) => {
    const files = await trx('drawings').where({ child_id: id }).pluck('filename');
    const n = await trx('children').where({ id }).del();
    return n ? files : null;
  });
}

// ---------- Малюнки ----------

export async function addDrawing(p) {
  const [row] = await db('drawings')
    .insert({
      child_id: p.childId,
      file_unique_id: p.fileUniqueId,
      file_id: p.fileId,
      filename: p.filename,
      width: p.width,
      height: p.height,
    })
    .onConflict('file_unique_id')
    .ignore()
    .returning('*');
  return row ?? null;
}

export async function deleteDrawing(id) {
  const [row] = await db('drawings').where({ id }).del().returning('filename');
  return row ?? null;
}

const drawingsQuery = (visitorId) =>
  db('drawings as d')
    .join('children as c', 'c.id', 'd.child_id')
    .leftJoin('likes as l', 'l.drawing_id', 'd.id')
    .select(
      'd.id',
      'd.child_id',
      'c.name as child_name',
      'd.filename',
      'd.width',
      'd.height',
      'd.created_at',
      db.raw(`to_char(${DAY}, 'YYYY-MM-DD') as day`),
      db.raw('count(l.drawing_id)::int as likes'),
      db.raw('coalesce(bool_or(l.visitor_id = ?), false) as liked', [visitorId || ''])
    )
    .groupBy('d.id', 'c.name');

export function listDrawings({ day, childId, visitorId }) {
  return drawingsQuery(visitorId)
    .modify((q) => day && q.whereRaw(`${DAY} = ?::date`, [day]))
    .modify((q) => childId && q.where('d.child_id', childId))
    .orderBy('d.id', 'desc');
}

// Сторінка малюнків дитини для бота: page = 0 — найновіші
export function childDrawingsPage(childId, page, perPage) {
  return db('drawings')
    .select('id', 'file_id', 'filename', 'created_at')
    .where({ child_id: childId })
    .orderBy('id', 'desc')
    .limit(perPage)
    .offset(page * perPage);
}

export async function countChildDrawings(childId) {
  const { n } = await db('drawings').where({ child_id: childId }).count({ n: '*' }).first();
  return Number(n);
}

// Дні, в які є малюнки, — від найновішого
export function listDays() {
  return db('drawings as d')
    .select(db.raw(`to_char(${DAY}, 'YYYY-MM-DD') as day`), db.raw('count(*)::int as drawings'))
    .groupByRaw(DAY)
    .orderByRaw(`${DAY} desc`);
}

// Прибирає записи, файли яких видалили вручну з папки uploads
export async function pruneMissing(exists) {
  const rows = await db('drawings').select('id', 'filename');
  const missing = rows.filter((r) => !exists(r.filename)).map((r) => r.id);
  if (missing.length) await db('drawings').whereIn('id', missing).del();
  return missing;
}

// ---------- Лайки ----------

export async function setLike(drawingId, visitorId, liked) {
  if (liked) {
    await db('likes').insert({ drawing_id: drawingId, visitor_id: visitorId }).onConflict().ignore();
  } else {
    await db('likes').where({ drawing_id: drawingId, visitor_id: visitorId }).del();
  }
  const { n } = await db('likes').where({ drawing_id: drawingId }).count({ n: '*' }).first();
  return Number(n);
}

// ---------- Рейтинг ----------
// Рахуються малюнки, намальовані в межах періоду [from, to]; range = null — за весь час

export const PERIODS = ['day', 'week', 'month', 'year', 'all'];

export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

// День/тиждень (з понеділка)/місяць/рік, у який потрапляє дата anchor
export async function periodRange(period, anchor = today()) {
  if (period === 'all') return null;
  const { rows } = await db.raw(
    `select to_char(date_trunc(:p, :a::date), 'YYYY-MM-DD') as "from",
            to_char(date_trunc(:p, :a::date) + ('1 ' || :p)::interval - interval '1 day', 'YYYY-MM-DD') as "to"`,
    { p: period, a: anchor }
  );
  return rows[0];
}

const inRange = (q, range) => range && q.whereRaw(`${DAY} between ?::date and ?::date`, [range.from, range.to]);

// by: 'likes' — сума лайків усіх малюнків, 'best' — лайки найкращого малюнка, 'drawings' — кількість малюнків
export const RATING_BY = ['likes', 'best', 'drawings'];

export function childrenRating({ range, by = 'likes' }) {
  const perDrawing = db('drawings as d')
    .leftJoin('likes as l', 'l.drawing_id', 'd.id')
    .select('d.child_id', db.raw('count(l.drawing_id)::int as likes'))
    .modify((q) => inRange(q, range))
    .groupBy('d.id');

  const ties = RATING_BY.filter((c) => c !== by);
  return db
    .from(perDrawing.as('p'))
    .join('children as c', 'c.id', 'p.child_id')
    .select(
      'c.id',
      'c.name',
      db.raw('count(*)::int as drawings'),
      db.raw('sum(p.likes)::int as likes'),
      db.raw('max(p.likes)::int as best')
    )
    .groupBy('c.id')
    .orderBy([by, ...ties].map((column) => ({ column, order: 'desc' })).concat({ column: 'c.name' }));
}

// Малюнки під рейтингом — залежать від того, за чим сортують дітей:
//   likes    — топ-10 за лайками
//   best     — найкращий малюнок кожної дитини
//   drawings — усі малюнки періоду, згруповані за дітьми в порядку рейтингу
export function topDrawings({ range, visitorId, by = 'likes' }) {
  const ranked = drawingsQuery(visitorId)
    .modify((q) => inRange(q, range))
    .select(
      db.raw('row_number() over (partition by d.child_id order by count(l.drawing_id) desc, d.id desc)::int as kid_place'),
      db.raw('count(*) over (partition by d.child_id)::int as kid_drawings'),
      db.raw('sum(count(l.drawing_id)) over (partition by d.child_id)::int as kid_likes')
    );
  const q = db.from(ranked.as('t')).select('*');

  if (by === 'best') {
    return q
      .where('kid_place', 1)
      .orderBy([{ column: 'likes', order: 'desc' }, { column: 'kid_likes', order: 'desc' }, { column: 'kid_drawings', order: 'desc' }, 'child_name']);
  }
  if (by === 'drawings') {
    return q
      .orderBy([{ column: 'kid_drawings', order: 'desc' }, { column: 'kid_likes', order: 'desc' }, 'child_name', { column: 'id', order: 'desc' }])
      .limit(60);
  }
  return q
    .where('likes', '>', 0)
    .orderBy([{ column: 'likes', order: 'desc' }, { column: 'id', order: 'desc' }])
    .limit(10);
}

// ---------- Користувачі бота ----------

export const getBotUser = (telegramId) => db('bot_users').where({ telegram_id: telegramId }).first();

export function authorizeBotUser(telegramId, name) {
  return db('bot_users').insert({ telegram_id: telegramId, name }).onConflict('telegram_id').merge(['name']);
}

export const logoutBotUser = (telegramId) => db('bot_users').where({ telegram_id: telegramId }).del();

export const setCurrentChild = (telegramId, childId) =>
  db('bot_users').where({ telegram_id: telegramId }).update({ current_child_id: childId });
