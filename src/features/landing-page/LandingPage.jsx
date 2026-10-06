import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '@lib/firebase';
import { FEATURES } from '../../config/features';
import { PROOF } from './landing.config';
import { submitAccessRequest } from '../../services/api/accessRequests';
import { requestManageLinks } from '../../services/api/manageLinks';
import {
  EmailScreen,
  GalleryScreen,
  HomeScreen,
  LinkScreen,
  ReviewScreen,
  SetsScreen,
} from './LandingScreens';
import './landing.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS = [
  {
    n: '01',
    title: 'One application link per night',
    body: 'Create the night, copy its link and post it wherever acts find you: Instagram, WhatsApp groups, a poster by the bar. Every application lands in one list, and acts don\u2019t need an account to apply.',
    screen: LinkScreen,
  },
  {
    n: '02',
    title: 'Review every act on one page',
    body: 'Each application shows the act\u2019s photo, music links, band and tech needs, and which set they\u2019d like. Listen without leaving the page, then accept or decline.',
    screen: ReviewScreen,
  },
  {
    n: '03',
    title: 'Give each act a set',
    body: 'Drag accepted acts onto the night\u2019s sets. Gigin shows who asked for which set, keeps the running order and tells each act their set time.',
    screen: SetsScreen,
  },
  {
    n: '04',
    title: 'Emails go out for you, with time to undo',
    body: 'Acts hear back automatically when you accept them, decline them or change their set. Every action has an Undo, and a decline waits five minutes before it sends.',
    screen: EmailScreen,
  },
  {
    n: '05',
    title: 'A private gallery after the gig',
    body: 'Upload photos and videos from the night and send the acts a private link to see and download them. Nothing is public, and you can revoke the link any time.',
    screen: GalleryScreen,
  },
];

function collapse(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function accessErrors(values) {
  const errors = {};
  const name = collapse(values.name);
  const venueName = collapse(values.venueName);
  const city = collapse(values.city);
  const email = collapse(values.email);
  const message = collapse(values.message);
  const nightsRaw = String(values.nightsPerMonth ?? '').trim();
  const nights = Number(nightsRaw);
  if (name.length > 80) errors.name = 'Keep your name under 80 characters.';
  else if (name.length < 2) errors.name = 'Enter your name.';
  if (venueName.length > 120) errors.venueName = 'Keep the venue name under 120 characters.';
  else if (venueName.length < 2) errors.venueName = "Enter your venue's name.";
  if (city.length < 2 || city.length > 80) errors.city = 'Enter the town or city.';
  if (!/^\d+$/.test(nightsRaw)) errors.nightsPerMonth = 'Enter roughly how many nights a month.';
  else if (!Number.isInteger(nights) || nights < 1 || nights > 31) errors.nightsPerMonth = 'Enter a number from 1 to 31.';
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > 160 || !EMAIL.test(email)) errors.email = 'Enter an email address like name@yourvenue.co.uk.';
  if (message.length > 2000) errors.message = 'Keep your message under 2,000 characters.';
  return errors;
}

const FIELD_ORDER = ['name', 'venueName', 'city', 'nightsPerMonth', 'email', 'message'];

const EMPTY_ACCESS = {
  name: '',
  venueName: '',
  city: '',
  nightsPerMonth: '',
  email: '',
  message: '',
  company: '',
};

function setMeta(selector, attr, name, content) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  const previous = tag.getAttribute('content');
  tag.setAttribute('content', content);
  return () => {
    if (previous == null) tag.remove();
    else tag.setAttribute('content', previous);
  };
}

function useLandingHead() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Gigin · Run your gig nights without the inbox chaos';
    const restore = [
      setMeta('meta[name="description"]', 'name', 'description', 'One application link per night, every act in one place, sets and emails handled. Invite-only for venues, starting in Cambridge.'),
      setMeta('meta[property="og:title"]', 'property', 'og:title', 'Gigin · Run your gig nights without the inbox chaos'),
      setMeta('meta[property="og:description"]', 'property', 'og:description', 'One application link per night, every act in one place, sets and emails handled. Invite-only for venues, starting in Cambridge.'),
      setMeta('meta[property="og:url"]', 'property', 'og:url', 'https://giginmusic.com/'),
      setMeta('meta[property="og:image"]', 'property', 'og:image', 'https://giginmusic.com/og/landing.svg'),
      setMeta('meta[property="og:image:width"]', 'property', 'og:image:width', '1200'),
      setMeta('meta[property="og:image:height"]', 'property', 'og:image:height', '630'),
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', 'Gigin · Run your gig nights without the inbox chaos'),
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', 'One application link per night, every act in one place, sets and emails handled. Invite-only for venues, starting in Cambridge.'),
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', 'https://giginmusic.com/og/landing.svg'),
    ];
    const canonical = document.querySelector('link[rel="canonical"]');
    const previousCanonical = canonical?.getAttribute('href');
    if (canonical) canonical.setAttribute('href', 'https://giginmusic.com/');
    return () => {
      document.title = previousTitle;
      restore.forEach((undo) => undo());
      if (canonical && previousCanonical) canonical.setAttribute('href', previousCanonical);
    };
  }, []);
}

function scrollToSection(id, focusId) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!focusId) return;
  window.setTimeout(() => {
    const field = document.getElementById(focusId);
    field?.focus();
  }, 350);
}

export const LandingPage = ({ setAuthModal, setAuthType }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasVenueProfile = Boolean(user?.venueProfiles?.length);
  useLandingHead();

  useEffect(() => {
    if (hasVenueProfile) navigate('/venues/dashboard/gigs');
  }, [hasVenueProfile, navigate]);

  const openLogin = () => {
    setAuthType?.('login');
    setAuthModal?.(true);
  };

  const startVenueAccount = () => {
    if (auth.currentUser?.emailVerified) {
      navigate('/venues/add-venue');
      return;
    }
    try { sessionStorage.setItem('redirect', '/venues/add-venue'); } catch { /* ignore */ }
    setAuthType?.('signup');
    setAuthModal?.(true);
  };

  const showProof = FEATURES.landingProof && PROOF.names.length > 0;
  const showProfile = FEATURES.keepProfile && FEATURES.publicProfile;
  const showFinder = FEATURES.venueFinder;

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap lp-header__bar">
          <Link to="/" className="lp-wordmark" aria-label="Gigin">gigin<span>.</span></Link>
          <div className="lp-header__actions">
            <button type="button" className="lp-login" onClick={openLogin}>Log in</button>
            <button type="button" className="lp-btn lp-btn--dark lp-btn--header" onClick={FEATURES.venueSignup ? startVenueAccount : () => scrollToSection('request-access', 'access-name')}>
              {FEATURES.venueSignup ? 'Create a venue account' : 'Request access'}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero__copy">
            <p className="lp-eyebrow">FOR VENUES THAT RUN GIG NIGHTS</p>
            <h1>Run your gig nights without the inbox chaos</h1>
            <p className="lp-hero__sub">One application link for each night. Acts apply in one place, you pick the line-up and give each act a set, and Gigin sends the emails.</p>
            <div className="lp-hero__actions">
              {FEATURES.venueSignup ? (
                <button type="button" className="lp-btn lp-btn--orange" onClick={startVenueAccount}>
                  Create a venue account
                </button>
              ) : (
                <button type="button" className="lp-btn lp-btn--orange" onClick={() => scrollToSection('request-access', 'access-name')}>
                  Request access
                </button>
              )}
              <button type="button" className="lp-quiet" onClick={() => scrollToSection('artists')}>I&apos;m an artist →</button>
            </div>
            {FEATURES.venueSignup ? (
              <p className="lp-small">
                <button type="button" className="lp-quiet" onClick={() => scrollToSection('request-access', 'access-name')}>Talk to us first</button>
              </p>
            ) : (
              <p className="lp-small">Invite-only while we set up the first venues.</p>
            )}
          </div>
          <div className="lp-hero__screen">
            <HomeScreen />
          </div>
        </section>

        {showProof ? (
          <section className="lp-proof" aria-label={PROOF.label}>
            <div className="lp-wrap lp-proof__row">
              <span>{PROOF.label.toUpperCase()}</span>
              {PROOF.names.map((name) => <b key={name}>{name}</b>)}
            </div>
          </section>
        ) : null}

        <section className="lp-how" id="how">
          <div className="lp-wrap">
            <p className="lp-eyebrow">HOW IT WORKS</p>
            <h2>From one link to a full line-up</h2>
            <p className="lp-lead">The same screens you&apos;ll use on the night. Everything for a gig lives on its own page.</p>
            {STEPS.map((step, index) => {
              const Screen = step.screen;
              return (
                <div className={`lp-step${index % 2 ? ' is-flip' : ''}`} key={step.n}>
                  <div className="lp-step__text">
                    <span>{step.n}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                  <Screen />
                </div>
              );
            })}
          </div>
        </section>

        <section className="lp-artists" id="artists">
          <div className="lp-wrap">
            <p className="lp-eyebrow">FOR ARTISTS</p>
            <h2>Playing a night booked on Gigin?</h2>
            <p className="lp-lead">You apply to a night from the venue&apos;s link as a guest. There&apos;s no account to make first.</p>
            <div className="lp-cards">
              <ManageCard />
              {showProfile ? <ProfileCard pressKit={FEATURES.pressKit} onLogin={openLogin} /> : null}
              {showFinder ? <FinderCard /> : null}
            </div>
          </div>
        </section>

        <section className="lp-request" id="request-access">
          <div className="lp-wrap lp-request__grid">
            <div>
              <p className="lp-eyebrow">FOR VENUES</p>
              <h2>Request access</h2>
              <p className="lp-lead">Gigin is invite-only for now. We&apos;re setting up a small number of venues by hand, starting in Cambridge. Tell us about your nights and the founder will be in touch.</p>
              <p className="lp-already">Already invited? <button type="button" onClick={openLogin}>Log in</button></p>
            </div>
            <AccessCard />
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__bar">
          <div>
            <span className="lp-wordmark lp-wordmark--footer">gigin<span>.</span></span>
            <p>© 2026 Gigin · giginmusic.com</p>
          </div>
          <nav>
            <Link to="/terms-and-conditions">Terms</Link>
            <Link to="/privacy-policy">Privacy</Link>
            <button type="button" onClick={openLogin}>Log in</button>
          </nav>
        </div>
      </footer>
    </div>
  );
};

function ManageCard() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('form');
  const [sentTo, setSentTo] = useState('');
  const inputId = useId();

  const submit = async (event) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Enter the email address you applied with.');
      return;
    }
    if (!EMAIL.test(value)) {
      setError('Enter an email address like name@example.com.');
      return;
    }
    setError('');
    setPhase('sending');
    try {
      await requestManageLinks(value);
      setSentTo(value);
      setPhase('sent');
    } catch (err) {
      console.error(err);
      setPhase('form');
      setError('Something went wrong. Try again in a moment.');
    }
  };

  if (phase === 'sent') {
    return (
      <article className="lp-artist-card">
        <h3>Check your inbox</h3>
        <p>If {sentTo} has applied to a night on Gigin, we&apos;ve sent a fresh link for each application. It can take a minute to arrive.</p>
        <button
          type="button"
          className="lp-textbtn"
          onClick={() => {
            setPhase('form');
            setEmail('');
            setSentTo('');
          }}
        >
          Use a different email
        </button>
      </article>
    );
  }

  return (
    <article className="lp-artist-card">
      <h3>Applied to a night? Manage your application</h3>
      <p>Lost the email with your private link? Enter the address you applied with and we&apos;ll send a fresh one. You can change your details, check your set time or withdraw.</p>
      <form className="lp-manage" noValidate onSubmit={submit}>
        <label htmlFor={inputId}>Email you applied with</label>
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          aria-invalid={error ? 'true' : undefined}
          disabled={phase === 'sending'}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError('');
          }}
        />
        {error ? <p className="lp-field-error" role="alert">{error}</p> : null}
        <button type="submit" className="lp-btn lp-btn--light" disabled={phase === 'sending'}>
          {phase === 'sending' ? 'Sending…' : 'Email me a fresh link'}
        </button>
      </form>
    </article>
  );
}

function ProfileCard({ pressKit, onLogin }) {
  return (
    <article className="lp-artist-card">
      <h3>{pressKit ? 'Keep your profile, tech rider and press kit in one shareable link' : 'Keep your profile and tech rider in one shareable link'}</h3>
      <p>After you apply, you can keep what you sent as a free Gigin profile, with one link to send to any venue. Choose Keep my profile on the confirmation screen. You only set a password if you want one.</p>
      <div className="lp-profile" aria-hidden="true">
        <span>FT</span>
        <div>
          <strong>The Fen Street Trio</strong>
          <p>Jazz trio · Cambridge</p>
          <div>
            <em>Spotify</em>
            <em>Tech rider</em>
            {pressKit ? <em>Press kit</em> : null}
          </div>
          <code>giginmusic.com/artist/fen-street-trio</code>
        </div>
      </div>
      <p className="lp-already">Already kept a profile? <button type="button" onClick={onLogin}>Log in</button></p>
    </article>
  );
}

function FinderCard() {
  return (
    <article className="lp-artist-card">
      <span className="lp-soon">COMING SOON</span>
      <h3>Find venues</h3>
      <p>See which venues near you put on live music, what each one has (a PA, the capacity, how they book) and send them your profile. Starting in Cambridge.</p>
      <div className="lp-finder" aria-hidden="true">
        <div>
          <strong>Venue on Gigin</strong>
          <span>PA · 120 capacity · Books by link</span>
        </div>
        <div>
          <strong>Listed venue</strong>
          <span>No PA listed · 80 capacity</span>
        </div>
      </div>
    </article>
  );
}

export function AccessCard() {
  const [values, setValues] = useState(EMPTY_ACCESS);
  const [errors, setErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [banner, setBanner] = useState('');
  const [phase, setPhase] = useState('form');
  const [sentEmail, setSentEmail] = useState('');
  const thanksRef = useRef(null);
  const summaryId = useId();

  useEffect(() => {
    if (phase === 'success') thanksRef.current?.focus();
  }, [phase]);

  const update = (key, value) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (banner) setBanner('');
    if (showErrors) {
      const fresh = accessErrors(next);
      setErrors(fresh);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const fresh = accessErrors(values);
    setErrors(fresh);
    setShowErrors(true);
    const keys = FIELD_ORDER.filter((key) => fresh[key]);
    if (keys.length) {
      document.getElementById(`access-${keys[0]}`)?.focus();
      return;
    }
    setPhase('sending');
    setBanner('');
    try {
      await submitAccessRequest({
        name: values.name,
        venueName: values.venueName,
        city: values.city,
        nightsPerMonth: values.nightsPerMonth,
        email: values.email,
        message: values.message,
        company: values.company,
      });
      setSentEmail(collapse(values.email));
      setPhase('success');
    } catch (error) {
      setPhase('form');
      if (error?.status === 400 && Array.isArray(error?.payload?.fields)) {
        const local = accessErrors(values);
        const mapped = { ...local };
        error.payload.fields.forEach((field) => {
          if (!mapped[field]) {
            mapped[field] = field === 'message'
              ? 'Keep your message under 2,000 characters.'
              : (local[field] || 'Check this field.');
          }
        });
        setErrors(mapped);
        setShowErrors(true);
        const first = FIELD_ORDER.find((key) => mapped[key]);
        if (first) document.getElementById(`access-${first}`)?.focus();
        return;
      }
      setBanner(error?.status === 429 ? 'limit' : 'server');
    }
  };

  if (phase === 'success') {
    return (
      <div className="lp-access lp-access--done">
        <span className="lp-check" aria-hidden="true" />
        <h3 ref={thanksRef} tabIndex={-1}>Thanks, the founder will be in touch shortly.</h3>
        <p>We&apos;ve emailed a copy of your request to {sentEmail}.</p>
        <button
          type="button"
          className="lp-textbtn"
          onClick={() => {
            setValues(EMPTY_ACCESS);
            setErrors({});
            setShowErrors(false);
            setBanner('');
            setPhase('form');
            setSentEmail('');
          }}
        >
          Send another request
        </button>
      </div>
    );
  }

  const visible = showErrors ? errors : {};
  const count = FIELD_ORDER.filter((key) => visible[key]).length;
  const messageLength = values.message.length;

  return (
    <form className={`lp-access${phase === 'sending' ? ' is-sending' : ''}`} onSubmit={submit} noValidate>
      {count > 0 ? (
        <p className="lp-summary" id={summaryId} role="alert">
          {count === 1 ? 'Check the field highlighted below.' : `Check the ${count} fields highlighted below.`}
        </p>
      ) : null}
      <div className="lp-fields">
        <Field label="Your name" name="name" autoComplete="name" value={values.name} error={visible.name} disabled={phase === 'sending'} onChange={update} />
        <Field label="Venue name" name="venueName" autoComplete="organization" value={values.venueName} error={visible.venueName} disabled={phase === 'sending'} onChange={update} />
        <Field label="Town or city" name="city" autoComplete="address-level2" value={values.city} error={visible.city} disabled={phase === 'sending'} onChange={update} />
        <Field label="Gig nights a month" name="nightsPerMonth" inputMode="numeric" placeholder="e.g. 4" value={values.nightsPerMonth} error={visible.nightsPerMonth} disabled={phase === 'sending'} onChange={update} />
        <Field label="Email" name="email" type="email" autoComplete="email" wide value={values.email} error={visible.email} disabled={phase === 'sending'} onChange={update} />
        <div className="lp-field lp-field--wide">
          <label htmlFor="access-message">Anything we should know? <span>Optional</span></label>
          <textarea
            id="access-message"
            rows={4}
            placeholder="The kind of nights you run, how you book acts now"
            value={values.message}
            disabled={phase === 'sending'}
            aria-invalid={visible.message ? 'true' : undefined}
            aria-describedby={visible.message ? 'access-message-error' : undefined}
            onChange={(event) => update('message', event.target.value)}
          />
          {messageLength > 1500 ? <span className="lp-count">{messageLength} / 2000</span> : null}
          {visible.message ? <p id="access-message-error" className="lp-field-error">{visible.message}</p> : null}
        </div>
      </div>
      <div className="lp-hp" aria-hidden="true">
        <label htmlFor="access-company">Company</label>
        <input
          id="access-company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={values.company}
          onChange={(event) => update('company', event.target.value)}
        />
      </div>
      {banner === 'server' ? (
        <p className="lp-banner" role="alert"><strong>Your request didn&apos;t send.</strong> Something went wrong on our side. Your details are still here, so try again in a moment.</p>
      ) : null}
      {banner === 'limit' ? (
        <p className="lp-banner" role="alert"><strong>Too many requests.</strong> We&apos;ve had several requests from this connection. Try again in an hour. Your details are still here.</p>
      ) : null}
      <button type="submit" className="lp-btn lp-btn--orange lp-btn--block" disabled={phase === 'sending'}>
        {phase === 'sending' ? 'Sending…' : 'Request access'}
      </button>
      <p className="lp-fine">We&apos;ll only use these details to get in touch about Gigin. <Link to="/privacy-policy">Privacy policy</Link></p>
    </form>
  );
}

function Field({ label, name, type = 'text', autoComplete, inputMode, placeholder, value, error, disabled, onChange, wide = false }) {
  const errorId = `access-${name}-error`;
  return (
    <div className={`lp-field${wide ? ' lp-field--wide' : ''}`}>
      <label htmlFor={`access-${name}`}>{label}</label>
      <input
        id={`access-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {error ? <p id={errorId} className="lp-field-error">{error}</p> : null}
    </div>
  );
}
