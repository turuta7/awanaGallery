import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Завантаження даних: повертає [data, setData, {loading, error}]
export function useLoad(load, deps) {
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null });
    load()
      .then((d) => alive && (setData(d), setState({ loading: false, error: null })))
      .catch((error) => alive && setState({ loading: false, error }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [data, setData, state];
}

// Список малюнків з лайками: оновлюємо одразу, а якщо сервер відмовив — повертаємо як було
export function useLikeToggle(setDrawings) {
  return useCallback(
    async (drawing) => {
      const patch = (fields) =>
        setDrawings((list) => list?.map((d) => (d.id === drawing.id ? { ...d, ...fields } : d)));
      const liked = !drawing.liked;
      patch({ liked, likes: drawing.likes + (liked ? 1 : -1) });
      try {
        const res = await api.like(drawing.id, liked);
        patch({ liked: res.liked, likes: res.likes });
      } catch {
        patch({ liked: drawing.liked, likes: drawing.likes });
      }
    },
    [setDrawings]
  );
}

// Простий роутер на #/шлях
export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
