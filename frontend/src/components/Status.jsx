export default function Status({ loading, error }) {
  if (error) return <p className="empty">Не вдалося завантажити 😕 Спробуй оновити сторінку.</p>;
  if (loading) return <p className="empty">Завантаження…</p>;
  return null;
}
