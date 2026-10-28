import { fmtDay } from '../api.js';

// Дні з малюнками — горизонтальна стрічка
export default function DayPicker({ days, value, hrefFor }) {
  return (
    <nav className="days" aria-label="Дні">
      {days.map((d) => (
        <a key={d.day} href={hrefFor(d.day)} className={`chip${d.day === value ? ' active' : ''}`}>
          {fmtDay(d.day)} <span className="count">{d.drawings}</span>
        </a>
      ))}
    </nav>
  );
}
