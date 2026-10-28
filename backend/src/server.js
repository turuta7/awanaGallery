import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import sharp from 'sharp';
import { childrenRating, listChildren, listDays, listDrawings, setLike, topDrawings } from './db.js';
import { THUMBS_DIR, UPLOADS_DIR } from './bot.js';

const THUMB_WIDTH = 600;
const SAFE_NAME = /^[\w-]+\.(jpe?g|png|webp)$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const VISITOR_RE = /^[\w-]{8,64}$/;

// Прев'ю для сітки: робимо при першому запиті і кладемо в thumbs/
async function thumbnail(filename) {
  const out = path.join(THUMBS_DIR, filename + '.webp');
  try {
    await fs.access(out);
  } catch {
    await fs.mkdir(THUMBS_DIR, { recursive: true });
    await sharp(path.join(UPLOADS_DIR, filename))
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(out);
  }
  return out;
}

const withUrls = (d) => ({ ...d, url: `/uploads/${d.filename}`, thumb: `/thumbs/${d.filename}` });

// Анонімний id відвідувача з localStorage — за ним рахуємо, що він уже лайкнув
const visitorOf = (req) => {
  const v = req.get('X-Visitor-Id') || '';
  return VISITOR_RE.test(v) ? v : null;
};

const dayOf = (req) => (DAY_RE.test(req.query.day || '') ? req.query.day : undefined);

export function createServer() {
  const app = express();

  // Фронтенд може жити на іншому домені — тоді вкажи його в CORS_ORIGIN
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.use((req, res, next) => {
      res.set('Access-Control-Allow-Origin', corsOrigin);
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-Visitor-Id');
      res.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  app.get('/api/days', async (req, res) => {
    res.json(await listDays());
  });

  app.get('/api/children', async (req, res) => {
    res.json(await listChildren());
  });

  app.get('/api/drawings', async (req, res) => {
    const childId = Number(req.query.child) || undefined;
    const drawings = await listDrawings({ day: dayOf(req), childId, visitorId: visitorOf(req) });
    res.json(drawings.map(withUrls));
  });

  // Без day — рейтинг за весь час
  app.get('/api/rating', async (req, res) => {
    const day = dayOf(req);
    const [children, drawings] = await Promise.all([
      childrenRating({ day }),
      topDrawings({ day, visitorId: visitorOf(req) }),
    ]);
    res.json({ day: day ?? null, children, drawings: drawings.map(withUrls) });
  });

  app.put('/api/drawings/:id/like', express.json(), async (req, res) => {
    const visitorId = visitorOf(req);
    if (!visitorId) return res.status(400).json({ error: 'Немає X-Visitor-Id' });
    const id = Number(req.params.id);
    const liked = req.body?.liked !== false;
    try {
      res.json({ id, liked, likes: await setLike(id, visitorId, liked) });
    } catch (e) {
      // 23503 — малюнка вже немає (foreign key)
      if (e.code === '23503') return res.status(404).json({ error: 'Малюнок не знайдено' });
      throw e;
    }
  });

  app.get('/thumbs/:name', async (req, res) => {
    if (!SAFE_NAME.test(req.params.name)) return res.sendStatus(404);
    try {
      res.set('Cache-Control', 'public, max-age=2592000, immutable');
      res.type('image/webp').sendFile(await thumbnail(req.params.name));
    } catch {
      res.sendStatus(404);
    }
  });

  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));

  // Зібраний React (npm run build у frontend/) — якщо вказано STATIC_DIR, бек віддає і сайт
  if (process.env.STATIC_DIR) {
    const staticDir = path.resolve(process.env.STATIC_DIR);
    app.use(express.static(staticDir));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: 'Internal error' });
  });

  return app;
}
