import { useState } from 'react';
import { toast } from 'sonner';
import { submitAccessRequest } from '@services/api/accessRequests';
import { QUIZ_OPENING, quizResult, waitlistRequest } from './venueQuiz';
import '../desk/venue-desk.css';

export function VenueQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ booksLive: false, nights: 'sometimes', roomHire: false });
  const [wait, setWait] = useState({ name: '', email: '', city: '', note: '' });
  const [done, setDone] = useState(false);
  const result = quizResult(answers);
  const submit = async () => {
    try {
      await submitAccessRequest(waitlistRequest(wait));
      setDone(true);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Could not save that.');
    }
  };
  return (
    <div className="p-desk">
      {step === 0 ? (
        <section className="p-card">
          <h1>{QUIZ_OPENING}</h1>
          <button type="button" className="p-btn p-btn--dark" onClick={() => setStep(1)}>Start</button>
        </section>
      ) : null}
      {step === 1 ? (
        <section className="p-card">
          <h1>Do you book live music?</h1>
          <button type="button" className="p-btn" onClick={() => { setAnswers((prev) => ({ ...prev, booksLive: true })); setStep(2); }}>Yes</button>
          <button type="button" className="p-btn" onClick={() => { setAnswers((prev) => ({ ...prev, booksLive: false, roomHire: true })); setStep(3); }}>No, we hire the room out</button>
        </section>
      ) : null}
      {step === 2 ? (
        <section className="p-card">
          <h1>How often?</h1>
          <button type="button" className="p-btn" onClick={() => { setAnswers((prev) => ({ ...prev, nights: 'often' })); setStep(3); }}>Most weeks</button>
          <button type="button" className="p-btn" onClick={() => { setAnswers((prev) => ({ ...prev, nights: 'sometimes' })); setStep(3); }}>Now and then</button>
        </section>
      ) : null}
      {step === 3 && result === 'fit' ? <section className="p-card"><h1>Gigin is a great fit</h1><p>You book live music often enough for the legwork to pay off.</p></section> : null}
      {step === 3 && result === 'gaps' ? <section className="p-card"><h1>Gigin fits, with a few gaps</h1><p>You can still run nights here. Some pieces matter more once you book regularly.</p></section> : null}
      {step === 3 && result === 'waitlist' && !done ? (
        <section className="p-card">
          <h1>Not yet</h1>
          <p>Room hire is on the list. Leave your details and we will email you when it is ready.</p>
          <label>Name<input value={wait.name} onChange={(event) => setWait({ ...wait, name: event.target.value })} /></label>
          <label>Email<input value={wait.email} onChange={(event) => setWait({ ...wait, email: event.target.value })} /></label>
          <label>City<input value={wait.city} onChange={(event) => setWait({ ...wait, city: event.target.value })} /></label>
          <label>Note<textarea value={wait.note} onChange={(event) => setWait({ ...wait, note: event.target.value })} /></label>
          <button type="button" className="p-btn p-btn--dark" onClick={submit}>Join the waitlist</button>
        </section>
      ) : null}
      {done ? <section className="p-card"><h1>Thanks</h1><p>You are on the room-hire list.</p></section> : null}
    </div>
  );
}
