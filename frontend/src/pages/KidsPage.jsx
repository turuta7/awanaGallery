import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import Status from '../components/Status.jsx';

export default function KidsPage() {
  const [kids, , state] = useLoad(() => api.children(), []);
  if (!kids) return <Status {...state} />;
  if (!kids.length) return <p className="empty">Дітей ще не додано</p>;

  return (
    <>
      <h2>Діти</h2>
      <div className="kids">
        {kids.map((k) => (
          <a key={k.id} href={`#/kids/${k.id}`} className="kid">
            <span className="avatar">{k.name.slice(0, 1).toUpperCase()}</span>
            <span className="kid-name">{k.name}</span>
            <span className="muted">🖼 {k.drawings} · ❤️ {k.likes}</span>
          </a>
        ))}
      </div>
    </>
  );
}
