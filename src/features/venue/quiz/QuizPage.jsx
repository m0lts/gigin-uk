import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { submitAccessRequest } from '@services/api/accessRequests';
import { HIRE_WANTS, QUIZ_STEPS, quizResult, waitlistRequest } from './venueQuiz';
import '../desk/venue-desk.css';

export function QuizEntry() {
  return (
    <section className="p-card">
      <h2>Not sure Gigin fits how you work?</h2>
      <p>Five quick questions. We will tell you honestly, including what we do not do yet.</p>
      <Link className="p-btn" to="/quiz">Take the 1-minute quiz</Link>
    </section>
  );
}

export function VenueQuiz() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({ help: [] });
  const [result, setResult] = useState('');
  const [email, setEmail] = useState('');
  const [wants, setWants] = useState(['enquiries']);
  const [notify, setNotify] = useState(false);
  const [done, setDone] = useState(false);
  const step = QUIZ_STEPS[index];
  const choose = (value) => {
    const next = { ...answers, [step.id]: value };
    setAnswers(next);
    if (step.id === 'how' && value === 'artist') {
      navigate('/for-musicians');
      return;
    }
    if (step.id === 'how' && value === 'hire') {
      setResult('waitlist');
      return;
    }
    if (index < QUIZ_STEPS.length - 1) setIndex(index + 1);
    else setResult(quizResult(next));
  };
  const toggleHelp = (value) => {
    const help = answers.help.includes(value) ? answers.help.filter((item) => item !== value) : [...answers.help, value];
    setAnswers({ ...answers, help });
  };
  const sendWaitlist = async (note) => {
    try {
      await submitAccessRequest(waitlistRequest({ email, note, name: email }));
      setDone(true);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Could not save that.');
    }
  };
  return (
    <div className="p-desk">
      <header className="p-card__row"><Link to="/" className="p-word">gigin<span>.</span></Link><Link to="/">Exit</Link></header>
      {!result && step ? (
        <section className="p-card">
          <p className="p-muted">Question {index + 1} of {QUIZ_STEPS.length}</p>
          <h1>{step.title}</h1>
          {step.lede ? <p>{step.lede}</p> : null}
          {step.multiple ? (
            <>
              {step.options.map(([value, label, detail]) => (
                <button type="button" key={value} className="p-btn" aria-pressed={answers.help.includes(value)} onClick={() => toggleHelp(value)}>{label}{detail ? ` — ${detail}` : ''}</button>
              ))}
              <button type="button" className="p-btn p-btn--dark" onClick={() => (index < QUIZ_STEPS.length - 1 ? setIndex(index + 1) : setResult(quizResult(answers)))}>Continue</button>
            </>
          ) : step.options.map(([value, label, detail]) => (
            <button type="button" key={value} className="p-btn" onClick={() => choose(value)}>{label}{detail ? ` — ${detail}` : ''}</button>
          ))}
          {index > 0 ? <button type="button" className="p-text" onClick={() => setIndex(index - 1)}>Back</button> : null}
        </section>
      ) : null}
      {result === 'fit' ? (
        <section className="p-card">
          <h1>Gigin is a great fit</h1>
          <p>Here is what it will do from your first night. You still pay acts yourself. Gigin does not handle payments.</p>
          <button type="button" className="p-btn p-btn--dark" onClick={() => navigate('/venues/add-venue')}>Create your venue account</button>
        </section>
      ) : null}
      {result === 'gaps' ? (
        <section className="p-card">
          <h1>A good fit, with a couple of gaps</h1>
          <p>Gigin handles the booking side. Tickets and paying acts through Gigin are not built yet.</p>
          <label>Tell me when ticketing and payments arrive<input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} /></label>
          {notify ? <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label> : null}
          <button type="button" className="p-btn p-btn--dark" onClick={() => (notify ? sendWaitlist('Ticketing and payments') : navigate('/venues/add-venue'))}>Create your venue account</button>
        </section>
      ) : null}
      {result === 'waitlist' && !done ? (
        <section className="p-card">
          <h1>Not quite yet</h1>
          <p>Gigin does not handle hiring out your space yet. We will email you when it is ready.</p>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {HIRE_WANTS.map(([id, label]) => (
            <label key={id}><input type="checkbox" checked={wants.includes(id)} onChange={() => setWants((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])} /> {label}</label>
          ))}
          <button type="button" className="p-btn p-btn--dark" onClick={() => sendWaitlist(wants.join(', '))}>Tell me when it is ready</button>
          <button type="button" className="p-text" onClick={() => { setResult(''); setIndex(1); }}>Book your own nights too? Gigin already works for that.</button>
        </section>
      ) : null}
      {done ? <section className="p-card"><h1>Thanks</h1><p>You are on the list. We will email you when this is ready.</p></section> : null}
    </div>
  );
}
