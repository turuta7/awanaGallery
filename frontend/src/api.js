const BASE = import.meta.env.VITE_API_URL || '';

// Анонімний id відвідувача — щоб лайк від одного браузера рахувався один раз
function visitorId() {
  const make = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    let id = localStorage.getItem('visitorId');
    if (!id) localStorage.setItem('visitorId', (id = make()));
    return id;
  } catch {
    return (visitorId.fallback ??= make());
  }
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'X-Visitor-Id': visitorId(), ...options.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return s ? `?${s}` : '';
};

export const api = {
  days: () => request('/api/days'),
  children: () => request('/api/children'),
  drawings: (params) => request(`/api/drawings${qs(params)}`),
  rating: (params) => request(`/api/rating${qs(params)}`),
  like: (id, liked) =>
    request(`/api/drawings/${id}/like`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liked }),
    }),
};

export const imgUrl = (path) => BASE + path;

export function fmtDay(day, opts = { day: 'numeric', month: 'long', weekday: 'short' }) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('uk-UA', opts);
}

// Сьогодні за Києвом у форматі YYYY-MM-DD — так само, як дні рахує бек
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Підпис періоду рейтингу: «21–27 жовтня 2026», «жовтень 2026», «2026»
export function fmtPeriod(period, from, to) {
  if (period === 'year') return from.slice(0, 4);
  if (period === 'month') {
    const s = fmtDay(from, { month: 'long', year: 'numeric' }).replace(' р.', '');
    return s[0].toUpperCase() + s.slice(1);
  }
  if (period === 'week') {
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    const start = sameMonth ? String(Number(from.slice(8))) : fmtDay(from, { day: 'numeric', month: 'long' });
    return `${start} – ${fmtDay(to, { day: 'numeric', month: 'long', year: 'numeric' }).replace(' р.', '')}`;
  }
  return fmtDay(from, { day: 'numeric', month: 'long', year: 'numeric' });
}
