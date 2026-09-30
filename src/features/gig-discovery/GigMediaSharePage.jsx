import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedGigMedia, sharedGigMediaFileUrl, sharedGigMediaZipUrl } from '@services/api/gigMedia';

function formatSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function GigMediaSharePage() {
  const { token } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSharedGigMedia(token)
      .then((data) => { if (!cancelled) setPage(data); })
      .catch(() => { if (!cancelled) setError('This link is no longer available.'); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', fontFamily: 'Inter, Arial, sans-serif' }}>
      <p style={{ fontWeight: 700 }}>gigin.</p>
      {error ? <p>{error}</p> : null}
      {!error && !page ? <p>Loading photos and videos…</p> : null}
      {page ? (
        <>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>{page.title || 'Photos and videos'}</h1>
          {page.venueName ? <p style={{ color: '#4B5160' }}>{page.venueName}</p> : null}
          {page.media?.length ? (
            <>
              <p><a href={sharedGigMediaZipUrl(token)}>Download all as zip</a></p>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {page.media.map((item) => (
                  <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #E5E7EB' }}>
                    <span>{item.name} <small style={{ color: '#6B7280' }}>{formatSize(item.size)}</small></span>
                    <a href={sharedGigMediaFileUrl(token, item.id)}>Download</a>
                  </li>
                ))}
              </ul>
            </>
          ) : <p>No photos or videos yet.</p>}
        </>
      ) : null}
    </main>
  );
}
