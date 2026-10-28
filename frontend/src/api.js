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
  rating: (day) => request(`/api/rating${qs({ day })}`),
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
