import { useState } from 'react';
import { api, fmtDay } from '../api.js';
import { useLoad } from '../hooks.js';
import DayPicker from '../components/DayPicker.jsx';
import DrawingGrid from '../components/DrawingGrid.jsx';
import Status from '../components/Status.jsx';

export default function GalleryPage({ day: dayParam }) {
  const [days, , daysState] = useLoad(() => api.days(), []);
  const day = dayParam || days?.[0]?.day;
  const [drawings, setDrawings, state] = useLoad(() => (day ? api.drawings({ day }) : Promise.resolve([])), [day]);
  const [sort, setSort] = useState('new');

  if (!days) return <Status {...daysState} />;
  if (!days.length) return <p className="empty">Галерея поки порожня — малюнки скоро з’являться 🎨</p>;

  const sorted = drawings && (sort === 'top' ? [...drawings].sort((a, b) => b.likes - a.likes || b.id - a.id) : drawings);

  return (
    <>
      <DayPicker days={days} value={day} hrefFor={(d) => `#/day/${d}`} />
      <div className="section-head">
        <h2>{fmtDay(day, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</h2>
        <div className="seg">
          <button className={sort === 'new' ? 'active' : ''} onClick={() => setSort('new')}>Нові</button>
          <button className={sort === 'top' ? 'active' : ''} onClick={() => setSort('top')}>Популярні</button>
        </div>
      </div>
      <a className="link" href={`#/rating/day/${day}`}>🏆 Рейтинг цього дня →</a>
      {sorted ? <DrawingGrid drawings={sorted} setDrawings={setDrawings} /> : <Status {...state} />}
    </>
  );
}
