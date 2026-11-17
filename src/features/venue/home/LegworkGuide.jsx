import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { copyText, displayUrl } from './publicLinks';
import {
  enquiryReply,
  instagramBio,
  legworkProgress,
  venuePublicUrl,
  websiteEmbed,
} from './legwork';
import { readLegwork, writeLegwork } from './legworkStorage';
import './legwork.css';

function useVenue(venues) {
  const [searchParams] = useSearchParams();
  const selected = searchParams.get('venue') || '';
  return (venues || []).find((venue) => venue.venueId === selected)
    || ((venues || []).length === 1 ? venues[0] : null);
}

export function LegworkGuide({ venues }) {
  const venue = useVenue(venues);
  const url = venuePublicUrl(venue);
  const bare = displayUrl(url);
  const name = venue?.name || 'your venue';
  const [manual, setManual] = useState(() => readLegwork(venue?.venueId));
  const progress = legworkProgress(manual);
  const [copied, setCopied] = useState('');

  const mark = async (id, value) => {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(id);
    const next = writeLegwork(venue?.venueId, { [id]: true });
    setManual(next);
    window.setTimeout(() => setCopied(''), 1400);
  };

  const downloadPoster = async () => {
    if (!url) return;
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 480 });
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return;
    popup.document.write(`<!doctype html><title>QR poster</title><body style="font-family:Geist,sans-serif;padding:32px">
      <p style="letter-spacing:.08em;font-size:12px">${name}</p>
      <h1 style="font-weight:300;font-family:Newsreader,Georgia,serif">Scan to play at ${name}</h1>
      <img alt="QR code" src="${dataUrl}" width="240" height="240" />
      <p>${bare}</p>
      <script>onload=()=>print()<\/script>
    </body>`);
    popup.document.close();
    const next = writeLegwork(venue?.venueId, { qr: true });
    setManual(next);
  };

  return (
    <div className="p-guide">
      <header>
        <h1>Let Gigin do the legwork</h1>
        <p>A few one-off set-ups so acts come to you with everything you need, and promo turns up without chasing.</p>
      </header>
      <div className="p-guide__grid">
        <div className="p-guide__steps">
          <article className="p-card">
            <h2><span>1</span> Put your Gigin link on your website</h2>
            <p>Add a “Play at {name}” link to your site’s music or contact page. Acts who find you there apply with their music instead of emailing.</p>
            <div className="p-code">
              <code>{websiteEmbed(name, url)}</code>
              <button type="button" className="p-btn" onClick={() => mark('website', websiteEmbed(name, url))}>{copied === 'website' ? 'Copied' : 'Copy link code'}</button>
            </div>
            <p className="p-muted">Or just the link: {bare}</p>
          </article>
          <article className="p-card">
            <h2><span>2</span> Add it to your Instagram bio</h2>
            <p>Most acts check your Instagram first. Give them one place to go.</p>
            <div className="p-code">
              <code>{instagramBio(url)}</code>
              <button type="button" className="p-btn" onClick={() => mark('instagram', instagramBio(url))}>{copied === 'instagram' ? 'Copied' : 'Copy'}</button>
            </div>
          </article>
          <article className="p-card">
            <h2><span>3</span> Reply to every enquiry with your link</h2>
            <p>Save this as a quick reply in Gmail or Instagram. You never have to dig through attachments again: their music, rider and dates arrive in one place.</p>
            <div className="p-code">
              <code>{enquiryReply(url)}</code>
              <button type="button" className="p-btn" onClick={() => mark('reply', enquiryReply(url))}>{copied === 'reply' ? 'Copied' : 'Copy reply'}</button>
            </div>
          </article>
          <article className="p-card p-card--done">
            <h2>Post every night on Gigin, even ones you’ve already booked</h2>
            <p>Then the running order, set times, promo and your team’s view all live in one place.</p>
            <span className="p-chip is-good">Done</span>
          </article>
          <article className="p-card p-card--done">
            <h2>Let Gigin ask for promo</h2>
            <p>When you book an act, they’re asked for a bio, photos and a track with permission to post. You download it from the Promo tab.</p>
            <span className="p-chip is-good">Done for you</span>
          </article>
          <article className="p-card">
            <h2><span>6</span> Put a QR code on the bar</h2>
            <p>For musicians in the audience. Print it, stick it by the till.</p>
            <button type="button" className="p-btn p-btn--dark" onClick={downloadPoster}>Download PDF</button>
            <p className="p-muted">A6 card: “Musician? Scan to play at {name}”</p>
          </article>
        </div>
        <aside>
          <section className="p-card">
            <h2>Your venue link</h2>
            <p className="p-code"><code>{bare}</code></p>
            <button type="button" className="p-btn p-btn--dark" onClick={() => mark('website', url)}>{copied === 'website' ? 'Copied' : 'Copy'}</button>
            {url ? <a className="p-btn" href={url} target="_blank" rel="noreferrer">Preview</a> : null}
            <p className="p-muted">Shows your open gigs and lets acts send an enquiry when nothing’s open.</p>
          </section>
          <section className="p-card">
            <h2>This month</h2>
            <p className="p-stat"><span>Guide finished</span><strong>{progress.done} of {progress.total}</strong></p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function LegworkSidebarCard({ venueId, onOpen }) {
  const progress = legworkProgress(readLegwork(venueId));
  const width = `${Math.round((progress.done / progress.total) * 100)}%`;
  return (
    <button type="button" className="p-side-card" onClick={onOpen}>
      <span>Get the most out of Gigin</span>
      <span className="p-side-card__bar"><span style={{ width }} /></span>
      <span className="p-muted">{progress.done} of {progress.total} done</span>
    </button>
  );
}
