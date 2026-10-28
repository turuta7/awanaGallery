import { api, fmtDay } from '../api.js';
import { useLoad } from '../hooks.js';
import DrawingGrid from '../components/DrawingGrid.jsx';
import Status from '../components/Status.jsx';

export default function KidPage({ id }) {
  const [kids, , kidsState] = useLoad(() => api.children(), []);
  const [drawings, setDrawings, state] = useLoad(() => api.drawings({ child: id }), [id]);
  const kid = kids?.find((k) => k.id === id);

  if (!kids || !drawings) return <Status loading error={kidsState.error || state.error} />;
  if (!kid) return <p className="empty">Дитину не знайдено. <a href="#/kids">До списку</a></p>;

  // Масив малюнків дитини, розкладений по днях
  const byDay = Map.groupBy(drawings, (d) => d.day);
  const likes = drawings.reduce((s, d) => s + d.likes, 0);

  return (
    <>
      <a className="link" href="#/kids">← Усі діти</a>
      <div className="kid-head">
        <span className="avatar big">{kid.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{kid.name}</h2>
          <span className="muted">🖼 {drawings.length} малюнків · ❤️ {likes}</span>
        </div>
      </div>
      {!drawings.length && <p className="empty">Малюнків поки немає</p>}
      {[...byDay].map(([day, list]) => (
        <section key={day}>
          <h3>{fmtDay(day)}</h3>
          <DrawingGrid drawings={list} setDrawings={setDrawings} showChild={false} />
        </section>
      ))}
    </>
  );
}
