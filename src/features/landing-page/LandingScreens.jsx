function Bars({ filled = 1, total = 3 }) {
  return (
    <span className="lp-bars" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < filled ? 'is-on' : ''} />
      ))}
    </span>
  );
}

export function HomeScreen() {
  return (
    <div className="lp-screen lp-screen--home" aria-hidden="true">
      <p className="lp-screen__hello">Good evening, Jez</p>
      <p className="lp-screen__sub">Monday 10 November · The Old Bakery</p>
      <div className="lp-card">
        <div className="lp-card__head">
          <strong>Needs your attention</strong>
          <span>4 NEW</span>
        </div>
        <div className="lp-night">
          <div className="lp-date">
            <span>FRI</span>
            <b>14</b>
            <span>NOV</span>
          </div>
          <div className="lp-night__main">
            <div className="lp-night__title">
              Friday Night Live
              <em>3 new</em>
            </div>
            <p>Latest: The Fen Street Trio · 12 min ago</p>
            <p className="lp-night__meta">
              <Bars />
              1 of 3 sets booked · 8 applications
            </p>
          </div>
          <span className="lp-review">Review 3</span>
        </div>
        <div className="lp-linkrow">
          <span>giginmusic.com/gig/friday-night-live</span>
          <b>Copy link</b>
        </div>
      </div>
    </div>
  );
}

export function LinkScreen() {
  return (
    <div className="lp-screen" aria-hidden="true">
      <div className="lp-card">
        <div className="lp-card__head">
          <strong>Fill the night</strong>
          <span className="lp-pill"><i /> Open · 8 applications</span>
        </div>
        <div className="lp-linkrow">
          <span>giginmusic.com/gig/friday-night-live</span>
          <b>Copy</b>
        </div>
        <div className="lp-tiles">
          <span>QR code</span>
          <span>A5 poster</span>
          <span>WhatsApp</span>
        </div>
      </div>
    </div>
  );
}

export function ReviewScreen() {
  return (
    <div className="lp-screen" aria-hidden="true">
      <article className="lp-card lp-act">
        <span className="lp-avatar">FT</span>
        <div>
          <div className="lp-act__name">The Fen Street Trio <em>Guest</em> <b className="is-new">New</b></div>
          <p>Prefers Set 1</p>
          <div className="lp-act__actions">
            <span>Listen</span>
            <span>Decline</span>
            <strong>Accept</strong>
          </div>
        </div>
      </article>
      <article className="lp-card lp-act">
        <span className="lp-avatar">CC</span>
        <div>
          <div className="lp-act__name">Cambridge Hot Club <b className="is-ok">Accepted · Set 2</b></div>
          <p>No preference</p>
          <div className="lp-act__actions">
            <span className="lp-setpick">Set 2 ▾</span>
          </div>
        </div>
      </article>
    </div>
  );
}

export function SetsScreen() {
  return (
    <div className="lp-screen" aria-hidden="true">
      <div className="lp-card">
        <div className="lp-card__head">
          <strong>Sets</strong>
          <span>2 / 3 FILLED</span>
        </div>
        <div className="lp-set is-drop">
          <div>
            <b>Set 1 · 20:00</b>
            <p>The Fen Street Trio</p>
          </div>
          <em>Their pick</em>
        </div>
        <div className="lp-set">
          <div>
            <b>Set 2 · 21:00</b>
            <p>Cambridge Hot Club</p>
          </div>
          <span>Change ▾</span>
        </div>
        <div className="lp-set is-open">
          <div>
            <b>Set 3 · 22:00</b>
            <p>Open</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmailScreen() {
  return (
    <div className="lp-screen" aria-hidden="true">
      <div className="lp-card lp-mail">
        <span className="lp-mail__mark">gigin.</span>
        <strong>You&apos;re playing Set 1 at The Old Bakery on Fri 14 Nov</strong>
        <span className="lp-kicker">YOUR SET</span>
        <p>Set 1 · 20:00–20:45</p>
      </div>
      <div className="lp-toast">
        <span>The Fen Street Trio accepted for Set 1. We&apos;ve emailed them their set time.</span>
        <b>Undo</b>
      </div>
    </div>
  );
}

export function GalleryScreen() {
  return (
    <div className="lp-screen" aria-hidden="true">
      <div className="lp-card">
        <div className="lp-card__head">
          <strong>Photos and videos</strong>
          <span>6 files on this gig</span>
        </div>
        <div className="lp-gallery">
          {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
        </div>
        <p className="lp-private">Private link · confirmed acts only</p>
        <div className="lp-gallery__actions">
          <span>Revoke link</span>
          <span>Email confirmed acts</span>
        </div>
      </div>
    </div>
  );
}
