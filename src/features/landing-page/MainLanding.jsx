import { useNavigate } from 'react-router-dom';
import { FEATURES } from '../../config/features';
import { LaunchHeader } from '../shared/components/LaunchHeader';
import { MAIN_HEADLINE, musicianSteps } from './launchSections';
import './launch-landing.css';

const VENUE_STEPS = [
  ['Keep track of acts you want to book', 'Star the acts you love, with their music, promo and gig history in one place.'],
  ['See all your gigs at a glance', 'Every night, who is playing and what is still missing.'],
  ['Handle requests to play', 'Your venue page tells acts what you offer. Requests arrive with their music, so you both listen and reply in a click.'],
  ['Book people you trust', 'See which venues have confirmed their gigs and who would book them again.'],
];

export function MainLanding(props) {
  const navigate = useNavigate();
  const steps = musicianSteps(FEATURES);
  const venueStart = FEATURES.venueJoin ? '/venues/join' : '/venues/add-venue';
  return (
    <div className="ll">
      <LaunchHeader {...props} />
      <div className="ll__wrap">
        <section className="ll__hero">
          <div>
            <h1>{MAIN_HEADLINE}</h1>
            <p>Find the right people, book with confidence and keep growing.</p>
            <div className="ll__actions">
              <button type="button" className="ll__btn ll__btn--dark" onClick={() => navigate('/venues')}>I run a venue</button>
              <button type="button" className="ll__btn" onClick={() => navigate('/for-musicians')}>I play music</button>
            </div>
          </div>
          <div className="ll__stage" aria-hidden="true">
            <article className="ll__gig">
              <p className="ll__kicker">Thu 10 Dec · Hot Numbers</p>
              <strong>Discovery Sessions</strong>
              <p>19:00 Maya Reid</p>
              <p>20:00 The Fen Street Trio</p>
              <p>21:00 Sam Okoro</p>
            </article>
            <article className="ll__act">
              <p className="ll__kicker">Singer-songwriter · Cambridge</p>
              <h3>Maya Reid</h3>
              <p>Harbour Lights</p>
              <p>The Blue Moon would book again</p>
            </article>
          </div>
        </section>
        <section className="ll__pair" id="venues">
          <article className="ll__card">
            <p className="ll__kicker">For venues</p>
            <h2>Run your music nights in one place</h2>
            <ol>
              {VENUE_STEPS.map(([title, body], index) => (
                <li key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></li>
              ))}
            </ol>
            <div className="ll__actions"><button type="button" className="ll__btn ll__btn--dark" onClick={() => navigate(venueStart)}>Set up your venue</button></div>
          </article>
          {steps.length ? (
            <article className="ll__card ll__card--dark" id="artists">
              <p className="ll__kicker">For musicians</p>
              <h2>Get booked, and keep growing</h2>
              <ol>
                {steps.map((step, index) => (
                  <li key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.body}</p></div></li>
                ))}
              </ol>
              <div className="ll__actions"><button type="button" className="ll__btn" onClick={() => navigate(FEATURES.artistHome ? '/artists/join' : '/for-musicians')}>Make your page</button></div>
            </article>
          ) : null}
        </section>
        <section className="ll__close">
          <h2>Start with one gig</h2>
          <p>Post your next night, or make your page. It takes two minutes.</p>
          <div className="ll__actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="ll__btn ll__btn--dark" onClick={() => navigate('/venues')}>I run a venue</button>
            <button type="button" className="ll__btn" onClick={() => navigate('/for-musicians')}>I play music</button>
          </div>
        </section>
        <footer className="ll__foot">
          <span className="ll__word">gigin<i>.</i></span>
          <span>About · Help · Privacy · Terms</span>
        </footer>
      </div>
    </div>
  );
}
