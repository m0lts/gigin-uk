import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
      <div>
        <h1>Page not found</h1>
        <p>That page isn&apos;t on Gigin.</p>
        <Link to="/">Back home</Link>
      </div>
    </main>
  );
}
