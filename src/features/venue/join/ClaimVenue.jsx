import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { submitAccessRequest } from '@services/api/accessRequests';
import { HOW_OFTEN, JOIN_ROLES, claimRequest } from './venueJoin';
import '../desk/venue-desk.css';

export function VenueJoin() {
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    venueName: params.get('venue') || '',
    role: JOIN_ROLES[0],
    howOften: '4',
    name: '',
    email: '',
    city: '',
  });
  const [sent, setSent] = useState(false);
  const set = (key) => (event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  const submit = async () => {
    try {
      await submitAccessRequest(claimRequest({ ...draft, fromGig: params.get('from') || '' }));
      setSent(true);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Could not send that request.');
    }
  };
  if (sent) {
    return (
      <div className="p-desk">
        <h1>Request sent</h1>
        <p>We will approve {draft.venueName} before the public page goes live.</p>
      </div>
    );
  }
  return (
    <div className="p-desk">
      {step === 0 ? (
        <section className="p-card">
          <h1>Find your venue</h1>
          <label>Venue name<input value={draft.venueName} onChange={set('venueName')} /></label>
          <label>City<input value={draft.city} onChange={set('city')} /></label>
        </section>
      ) : null}
      {step === 1 ? (
        <section className="p-card">
          <h1>Your role</h1>
          {JOIN_ROLES.map((role) => (
            <label key={role}><input type="radio" name="role" checked={draft.role === role} onChange={() => setDraft((prev) => ({ ...prev, role }))} /> {role}</label>
          ))}
        </section>
      ) : null}
      {step === 2 ? (
        <section className="p-card">
          <h1>How often</h1>
          {HOW_OFTEN.map((item) => (
            <label key={item.id}><input type="radio" name="often" checked={draft.howOften === item.id} onChange={() => setDraft((prev) => ({ ...prev, howOften: item.id }))} /> {item.label}</label>
          ))}
          <label>Your name<input value={draft.name} onChange={set('name')} /></label>
          <label>Email<input value={draft.email} onChange={set('email')} /></label>
        </section>
      ) : null}
      {step === 3 ? (
        <section className="p-card">
          <h1>Confirm</h1>
          <p>{draft.name} at {draft.venueName}, {draft.city}. {draft.role}.</p>
          <button type="button" className="p-btn p-btn--dark" onClick={submit}>Send for approval</button>
        </section>
      ) : null}
      {step < 3 ? <button type="button" className="p-btn p-btn--dark" onClick={() => setStep(step + 1)}>Continue</button> : null}
    </div>
  );
}
