import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import '@styles/artists/gig-page.styles.css';
import { getSharedGigMedia, sharedGigMediaFileUrl, sharedGigMediaZipUrl } from '@services/api/gigMedia';

function formatSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatDay(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

function isVideo(item) {
  return String(item.contentType || '').startsWith('video/');
}

export function GigMediaSharePage() {
  const { token } = useParams();
  const [page, setPage] = useState(null);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(-1);
  const [zipState, setZipState] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSharedGigMedia(token)
      .then((data) => { if (!cancelled) setPage(data); })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [token]);

  const media = page?.media || [];
  const photos = media.filter((item) => !isVideo(item)).length;
  const videos = media.length - photos;
  const total = useMemo(() => media.reduce((sum, item) => sum + (Number(item.size) || 0), 0), [media]);
  const venue = page?.venueName || 'The venue';
  const zipName = `${(page?.title || 'gig').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gig'}.zip`;

  const downloadAll = async () => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (mobile) {
      window.location.assign(sharedGigMediaZipUrl(token));
      setZipState('started');
      return;
    }
    setZipState('preparing');
    try {
      const response = await fetch(sharedGigMediaZipUrl(token));
      if (!response.ok) throw new Error('zip');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipName;
      link.click();
      URL.revokeObjectURL(url);
      setZipState('started');
    } catch {
      setZipState('failed');
    }
  };

  const downloadOne = (item) => {
    const link = document.createElement('a');
    link.href = sharedGigMediaFileUrl(token, item.id);
    link.download = item.name || 'file';
    link.click();
    setToast(`Downloading ${item.name || 'file'}`);
  };

  if (missing) {
    return (
      <div className="ga-page ga-missing">
        <header className="ga-top"><a className="ga-logo" href="/">gigin.</a></header>
        <main>
          <p className="ga-mono">PHOTOS AND VIDEOS</p>
          <h1>This link is no longer available</h1>
          <p>The venue may have made a new link or turned sharing off. Ask them to send you a new one.</p>
          <a className="ga-dark" href="https://giginmusic.com">Go to giginmusic.com</a>
        </main>
      </div>
    );
  }

  if (!page) {
    return <div className="ga-page"><p className="ga-quiet">Loading photos and videos…</p></div>;
  }

  const current = media[open];

  return (
    <div className="ga-page">
      <header className="ga-top">
        <a className="ga-logo" href="/">gigin.</a>
        <span>Shared by {venue}</span>
      </header>
      <main className="ga-media">
        <p className="ga-mono">{(page.title || 'GIG').toUpperCase()}{page.gigDate ? ` · ${formatDay(page.gigDate)}` : ''}</p>
        <h1>Photos and videos</h1>
        {media.length ? (
          <>
            <p>From {venue} · {photos} photo{photos === 1 ? '' : 's'}, {videos} video{videos === 1 ? '' : 's'} · {formatSize(total)}</p>
            <div className="ga-media__actions">
              <button type="button" className="ga-dark" disabled={zipState === 'preparing'} onClick={downloadAll}>
                {zipState === 'preparing' ? 'Preparing your zip…' : `Download all (${formatSize(total)})`}
              </button>
              <p>On a phone, a big zip can be slow. You can also save files one at a time.</p>
            </div>
            {zipState === 'started' && <p className="ga-note">Your download has started: {zipName} ({formatSize(total)}). Check your downloads folder.</p>}
            {zipState === 'failed' && (
              <div className="ga-error-box">
                <strong>The download didn&apos;t finish</strong>
                <p>The connection dropped while we were building the zip. The files are fine. Try again, or save them one at a time.</p>
                <button type="button" className="ga-text" onClick={downloadAll}>Try again</button>
              </div>
            )}
            <ul className="ga-grid">
              {media.map((item, index) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setOpen(index)} aria-label={`${isVideo(item) ? 'Video' : 'Photo'} ${index + 1} of ${media.length}, ${item.name || ''}`}>
                    {item.thumbUrl || (!isVideo(item) && sharedGigMediaFileUrl(token, item.id, { inline: true })) ? (
                      <img src={item.thumbUrl || sharedGigMediaFileUrl(token, item.id, { inline: true })} alt="" />
                    ) : <span className="ga-grid__video" />}
                    {isVideo(item) && item.durationSec ? <em>{Math.round(item.durationSec)}s</em> : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="ga-fine">This link is private. {venue} shared it with the acts who played. Ask before posting photos of other acts.</p>
          </>
        ) : (
          <>
            <h2>No photos or videos yet</h2>
            <p>{venue} hasn&apos;t added any files to this gig yet. Keep this link and check back after the night.</p>
          </>
        )}
      </main>
      {current && (
        <div className="ga-viewer" role="dialog" aria-modal="true">
          <header>
            <span>{open + 1} of {media.length}</span>
            <button type="button" onClick={() => downloadOne(current)}>Download</button>
            <button type="button" onClick={() => setOpen(-1)}>Close</button>
          </header>
          {isVideo(current) ? (
            <video src={sharedGigMediaFileUrl(token, current.id, { inline: true })} controls />
          ) : (
            <img src={sharedGigMediaFileUrl(token, current.id, { inline: true })} alt={current.name || ''} />
          )}
          <footer>
            <button type="button" disabled={open === 0} onClick={() => setOpen((index) => index - 1)}>Previous</button>
            <button type="button" disabled={open === media.length - 1} onClick={() => setOpen((index) => index + 1)}>Next</button>
          </footer>
          {toast && <p className="ga-toast" role="status">{toast}</p>}
        </div>
      )}
    </div>
  );
}
