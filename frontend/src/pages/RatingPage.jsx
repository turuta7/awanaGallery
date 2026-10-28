import { addDays, api, fmtPeriod, today } from '../api.js';
import { useLoad } from '../hooks.js';
import DayPicker from '../components/DayPicker.jsx';
import DrawingGrid from '../components/DrawingGrid.jsx';
import Status from '../components/Status.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];

const PERIODS = [
  ['day', 'День'],
  ['week', 'Тиждень'],
  ['month', 'Місяць'],
  ['year', 'Рік'],
  ['all', 'Весь час'],
];

// За чим сортувати дітей: сума лайків, лайки найкращого малюнка або кількість малюнків
const SORTS = [
  ['likes', '❤️ Усі лайки', 'Сума лайків на всіх малюнках'],
  ['best', '⭐ Один малюнок', 'Лайки найкращого малюнка'],
  ['drawings', '🖼 Малюнки', 'Кількість малюнків'],
];

const DRAWINGS_TITLE = {
  likes: 'Найпопулярніші малюнки',
  best: 'Найкращий малюнок кожної дитини',
  drawings: 'Усі малюнки за період',
};

const href = (period, day, by) => `#/rating/${period}${day ? `/${day}` : ''}${by !== 'likes' ? `?by=${by}` : ''}`;

// period: day | week | month | year | all; day — дата всередині періоду; by: likes | best | drawings
export default function RatingPage({ period, day: dayParam, by }) {
  // Дні вантажимо один раз: для «День» без дати беремо останній день з малюнками
  const [days, , daysState] = useLoad(() => api.days(), []);
  const day = period === 'day' ? dayParam || days?.[0]?.day : dayParam;
  const waiting = period === 'day' && !day;
  // Поки чекаємо на дні — не скидаємо рейтинг, щоб сторінка не блимала порожнечею
  const [rating, setRating, state] = useLoad(
    () => (waiting ? new Promise(() => {}) : api.rating({ period, day, by })),
    [period, day, by, waiting]
  );
  const setDrawings = (fn) => setRating((r) => r && { ...r, drawings: fn(r.drawings) });

  return (
    <>
      <h2>🏆 Рейтинг</h2>

      <div className="rating-controls">
        <div className="seg">
          {PERIODS.map(([p, label]) => (
            <a key={p} className={period === p ? 'active' : ''} href={href(p, null, by)}>{label}</a>
          ))}
        </div>
        <div className="seg">
          {SORTS.map(([b, label, title]) => (
            <a key={b} className={by === b ? 'active' : ''} href={href(period, dayParam, b)} title={title}>{label}</a>
          ))}
        </div>
      </div>

      {period === 'day' && days?.length > 0 && <DayPicker days={days} value={day} hrefFor={(d) => href('day', d, by)} />}
      {period === 'day' && days && !days.length && <p className="empty">Малюнків ще немає</p>}
      {period === 'day' && !days && <Status {...daysState} />}

      {/* Поки вантажиться новий період, rating ще від попереднього — тому беремо період з самих даних */}
      {rating && ['week', 'month', 'year'].includes(rating.period) && (
        <div className="period-nav">
          <a href={href(rating.period, addDays(rating.from, -1), by)} aria-label="Попередній">‹</a>
          <strong>{fmtPeriod(rating.period, rating.from, rating.to)}</strong>
          {rating.to < today() ? (
            <a href={href(rating.period, addDays(rating.to, 1), by)} aria-label="Наступний">›</a>
          ) : (
            <span className="disabled">›</span>
          )}
        </div>
      )}

      {rating ? (
        <>
          <ol className="ranking">
            {rating.children.map((c, i) => (
              <li key={c.id}>
                <span className="place">{MEDALS[i] ?? i + 1}</span>
                <a href={`#/kids/${c.id}`} className="kid-name">{c.name}</a>
                <span className={by === 'drawings' ? 'metric main' : 'metric'} title="Малюнків">🖼 {c.drawings}</span>
                <span className={by === 'best' ? 'metric main' : 'metric'} title="Лайків у найкращого малюнка">⭐ {c.best}</span>
                <span className={by === 'likes' ? 'metric main' : 'metric'} title="Усього лайків">❤️ {c.likes}</span>
              </li>
            ))}
          </ol>
          {!rating.children.length && <p className="empty">За цей період малюнків немає</p>}
          {rating.children.length > 0 && (
            <>
              <h3>{DRAWINGS_TITLE[rating.by]}</h3>
              <DrawingGrid
                drawings={rating.drawings}
                setDrawings={setDrawings}
                showDay={period !== 'day'}
                empty="Лайків ще немає — будь першим ❤️"
              />
            </>
          )}
        </>
      ) : (
        !waiting && <Status {...state} />
      )}
    </>
  );
}
