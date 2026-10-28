import { api, fmtDay } from '../api.js';
import { useLoad } from '../hooks.js';
import DayPicker from '../components/DayPicker.jsx';
import DrawingGrid from '../components/DrawingGrid.jsx';
import Status from '../components/Status.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];

// day === undefined — за весь час; 'day' без дати — за останній день з малюнками
export default function RatingPage({ day: dayParam, period }) {
  const [days, , daysState] = useLoad(() => api.days(), []);
  const day = period === 'day' ? dayParam || days?.[0]?.day : undefined;
  const ready = period === 'all' || days;
  const [rating, setRating, state] = useLoad(
    () => (ready && (period === 'all' || day) ? api.rating(day) : Promise.resolve(null)),
    [period, day, !!ready]
  );
  const setDrawings = (fn) => setRating((r) => r && { ...r, drawings: fn(r.drawings) });

  return (
    <>
      <div className="section-head">
        <h2>🏆 Рейтинг</h2>
        <div className="seg">
          <a className={period === 'day' ? 'active' : ''} href="#/rating/day">За день</a>
          <a className={period === 'all' ? 'active' : ''} href="#/rating">За весь час</a>
        </div>
      </div>

      {period === 'day' && days && !days.length && <p className="empty">Малюнків ще немає</p>}
      {period === 'day' && days?.length > 0 && <DayPicker days={days} value={day} hrefFor={(d) => `#/rating/${d}`} />}
      {period === 'day' && !days && <Status {...daysState} />}

      {rating ? (
        <>
          <p className="muted">
            {day ? `Малюнки за ${fmtDay(day, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Усі малюнки за весь час'}
          </p>
          <ol className="ranking">
            {rating.children.map((c, i) => (
              <li key={c.id}>
                <span className="place">{MEDALS[i] ?? i + 1}</span>
                <a href={`#/kids/${c.id}`} className="kid-name">{c.name}</a>
                <span className="muted">🖼 {c.drawings}</span>
                <strong>❤️ {c.likes}</strong>
              </li>
            ))}
          </ol>
          {!rating.children.length && <p className="empty">У цей день малюнків немає</p>}
          <h3>Найпопулярніші малюнки</h3>
          <DrawingGrid
            drawings={rating.drawings}
            setDrawings={setDrawings}
            showDay={!day}
            empty="Лайків ще немає — будь першим ❤️"
          />
        </>
      ) : (
        <Status {...state} />
      )}
    </>
  );
}
