import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEATURES } from '../../config/features';
import { LaunchHeader } from '../shared/components/LaunchHeader';
import { ARTIST_FAQ, artistJourney } from './launchSections';
import './launch-landing.css';

function Popup({ kind, onClose }) {
  const [playing, setPlaying] = useState(false);
  if (!kind) return null;
  return (
    <div className="ll-pop" role="dialog" aria-modal="true" aria-label={kind === 'map' ? 'Explore the venue map' : 'Preview an artist page'}>
      <div className="ll-pop__card">
        <header>
          <h2>{kind === 'map' ? 'Explore the venue map' : 'Preview an artist page'}</h2>
          <button type="button" className="ll__btn" onClick={onClose}>Close</button>
        </header>
        {kind === 'map' ? (
          <article className="ll__gig">
            <p className="ll__kicker">On Gigin · Cambridge</p>
            <strong>Hot Numbers</strong>
            <p>Cafe and bar. Books singer-songwriters and small bands.</p>
            <p>Search and filters sit on the map inside your dashboard.</p>
          </article>
        ) : (
          <article className="ll__act">
            <p className="ll__kicker">Singer-songwriter · Cambridge</p>
            <h3>Maya Reid</h3>
            <button type="button" className="ll__btn" aria-pressed={playing} onClick={() => setPlaying((on) => !on)}>{playing ? 'Playing Harbour Lights' : 'Play Harbour Lights'}</button>
            <p>Photos, upcoming gigs, and a booking button live on the public page.</p>
          </article>
        )}
      </div>
    </div>
  );
}

export function ArtistLanding(props) {
  const navigate = useNavigate();
  const sections = artistJourney(FEATURES);
  const [active, setActive] = useState(sections[0]?.id || '');
  const [popup, setPopup] = useState('');
  useEffect(() => {
    const nodes = [...document.querySelectorAll('[data-step]')];
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const hit = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit) setActive(hit.target.getAttribute('data-step'));
    }, { rootMargin: '-35% 0px -45% 0px', threshold: [0.25, 0.6] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections.length]);
  return (
    <div className="ll">
      <LaunchHeader {...props} />
      <div className="ll-artist">
        <nav className="ll-ticker" aria-label="On this page">
          {sections.map((section) => (
            <button type="button" key={section.id} className={active === section.id ? 'is-on' : ''} onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{section.title}</button>
          ))}
        </nav>
        <div className="ll-journey">
          <section className="ll__hero" style={{ paddingTop: 28 }}>
            <div>
              <p className="ll__kicker">For musicians</p>
              <h1>Your next gig awaits</h1>
              <p>The venues already on Gigin, in one place.</p>
              {FEATURES.venueMap ? <button type="button" className="ll__btn ll__btn--dark" onClick={() => setPopup('map')}>Find venues</button> : null}
            </div>
            {FEATURES.venueMap ? (
              <div className="ll__stage" aria-hidden="true">
                <article className="ll__gig"><p className="ll__kicker">Cambridge</p><strong>Hot Numbers</strong><p>Books live music</p></article>
                <article className="ll__act"><p className="ll__kicker">On the map</p><h3>Maya Reid</h3><p>Singer-songwriter</p></article>
              </div>
            ) : null}
          </section>
          {sections.map((section) => (
            <section className="ll-block" id={section.id} data-step={section.id} key={section.id}>
              <div>
                <p className="ll__kicker">{section.kicker}</p>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.action ? <button type="button" className="ll__btn" onClick={() => setPopup(section.popup)}>{section.action}</button> : null}
              </div>
              {section.steps ? (
                <div className="ll-steps">
                  {section.steps.map((step, index) => <article key={step}><span>{index + 1}</span><strong>{step}</strong></article>)}
                </div>
              ) : <div className="ll-mock" aria-hidden="true" />}
            </section>
          ))}
          <section className="ll-faq" id="questions">
            <h2>Questions</h2>
            {ARTIST_FAQ.map((item) => (
              <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>
            ))}
          </section>
          <section className="ll-cta">
            <h2>Make your page today</h2>
            <button type="button" className="ll__btn" onClick={() => navigate(FEATURES.artistHome ? '/artists/join' : '/')}>Make your page</button>
          </section>
        </div>
      </div>
      <Popup kind={popup} onClose={() => setPopup('')} />
    </div>
  );
}
