import { useEffect, useState } from 'react';
import { fmtDay, imgUrl } from '../api.js';
import { useLikeToggle } from '../hooks.js';

export function LikeButton({ drawing, onToggle, big = false }) {
  return (
    <button
      className={`like${drawing.liked ? ' liked' : ''}${big ? ' big' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(drawing);
      }}
      aria-pressed={drawing.liked}
      aria-label={drawing.liked ? 'Прибрати лайк' : 'Лайкнути'}
    >
      <span className="heart">{drawing.liked ? '❤️' : '🤍'}</span>
      <span>{drawing.likes}</span>
    </button>
  );
}

function Lightbox({ drawing, onClose, onToggle, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button className="lb-close" aria-label="Закрити">✕</button>
      {onPrev && (
        <button className="lb-nav lb-prev" onClick={(e) => (e.stopPropagation(), onPrev())} aria-label="Попередній">‹</button>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={imgUrl(drawing.url)} alt={`Малюнок: ${drawing.child_name}`} />
        <figcaption>
          <a href={`#/kids/${drawing.child_id}`} onClick={onClose}>{drawing.child_name}</a>
          <span className="muted">{fmtDay(drawing.day)}</span>
          <LikeButton drawing={drawing} onToggle={onToggle} big />
        </figcaption>
      </figure>
      {onNext && (
        <button className="lb-nav lb-next" onClick={(e) => (e.stopPropagation(), onNext())} aria-label="Наступний">›</button>
      )}
    </div>
  );
}

export default function DrawingGrid({ drawings, setDrawings, showChild = true, showDay = false, empty = 'Малюнків поки немає' }) {
  const onToggle = useLikeToggle(setDrawings);
  const [openId, setOpenId] = useState(null);
  const index = drawings.findIndex((d) => d.id === openId);
  const open = drawings[index];

  if (!drawings.length) return <p className="empty">{empty}</p>;

  return (
    <>
      <div className="grid">
        {drawings.map((d) => (
          <article key={d.id} className="card" onClick={() => setOpenId(d.id)}>
            <div className="thumb" style={d.width && d.height ? { aspectRatio: `${d.width} / ${d.height}` } : undefined}>
              <img src={imgUrl(d.thumb)} alt={`Малюнок: ${d.child_name}`} loading="lazy" />
            </div>
            <div className="card-foot">
              <div className="card-meta">
                {showChild && <strong>{d.child_name}</strong>}
                {showDay && <span className="muted">{fmtDay(d.day, { day: 'numeric', month: 'short' })}</span>}
              </div>
              <LikeButton drawing={d} onToggle={onToggle} />
            </div>
          </article>
        ))}
      </div>
      {open && (
        <Lightbox
          drawing={open}
          onToggle={onToggle}
          onClose={() => setOpenId(null)}
          onPrev={index > 0 ? () => setOpenId(drawings[index - 1].id) : null}
          onNext={index < drawings.length - 1 ? () => setOpenId(drawings[index + 1].id) : null}
        />
      )}
    </>
  );
}
