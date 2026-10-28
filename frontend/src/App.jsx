import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useHashRoute } from './hooks.js';
import GalleryPage from './pages/GalleryPage.jsx';
import KidPage from './pages/KidPage.jsx';
import KidsPage from './pages/KidsPage.jsx';
import RatingPage from './pages/RatingPage.jsx';

function page(route) {
  let m;
  if ((m = route.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/))) return ['gallery', <GalleryPage key={m[1]} day={m[1]} />];
  if (route === '/kids') return ['kids', <KidsPage />];
  if ((m = route.match(/^\/kids\/(\d+)$/))) return ['kids', <KidPage key={m[1]} id={Number(m[1])} />];
  // #/rating/<період>/<дата>?by=drawings
  if ((m = route.match(/^\/rating(?:\/(day|week|month|year|all))?(?:\/(\d{4}-\d{2}-\d{2}))?(?:\?by=(\w+))?$/))) {
    return ['rating', <RatingPage period={m[1] || 'all'} day={m[2]} by={m[3] === 'drawings' ? 'drawings' : 'likes'} />];
  }
  return ['gallery', <GalleryPage />];
}

const TABS = [
  ['gallery', '#/', '🖼 Галерея'],
  ['kids', '#/kids', '👧 Діти'],
  ['rating', '#/rating/day', '🏆 Рейтинг'],
];

export default function App() {
  const route = useHashRoute();
  const [tab, content] = page(route);

  return (
    <>
      <header>
        <a href="#/" className="logo">🎨 Малюнки Awana</a>
        <nav className="tabs">
          {TABS.map(([id, href, label]) => (
            <a key={id} href={href} className={tab === id ? 'active' : ''}>{label}</a>
          ))}
        </nav>
      </header>
      <main>
        <ErrorBoundary route={route}>{content}</ErrorBoundary>
      </main>
    </>
  );
}
