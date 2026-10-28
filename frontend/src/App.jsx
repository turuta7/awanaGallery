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
  if (route === '/rating') return ['rating', <RatingPage period="all" />];
  if (route === '/rating/day') return ['rating', <RatingPage period="day" />];
  if ((m = route.match(/^\/rating\/(\d{4}-\d{2}-\d{2})$/))) return ['rating', <RatingPage period="day" day={m[1]} />];
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
      <main>{content}</main>
    </>
  );
}
