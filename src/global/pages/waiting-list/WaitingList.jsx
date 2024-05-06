import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CoinIcon, 
    DotIcon, 
    ErrorIcon, 
    GuitarsIcon, 
    MicrophoneLinesIcon, 
    PeopleGroupIcon, 
    PeopleRoofIcon, 
    ShieldIcon, 
    SuccessIcon, 
    TutoringIcon 
} from "../../components/Icons/Icons";
import './waiting-list.styles.css'


export const WaitingList = ({ user, setUser }) => {

    const navigate = useNavigate();
    const [formValues, setFormValues] = useState({ name: '', email: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    const [submissionError, setSubmissionError] = useState(false);
    const [mobileView, setMobileView] = useState(false);
  
    useEffect(() => {
      const handleResize = () => {
        setMobileView(window.innerWidth < 768);
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
  
    const handleInputChange = (event) => {
      const { name, value } = event.target;
      setFormValues(prev => ({ ...prev, [name]: value }));
      setFormError('');
    };
  
    const validateEmail = (email) => /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(email);
  
    const handleFormSubmission = async (event) => {
      event.preventDefault();
      setLoading(true);
  
      if (!formValues.name || !formValues.email || !formValues.type) {
        setFormError('Please fill in all fields.');
        setLoading(false);
        return;
      }
  
      if (!validateEmail(formValues.email)) {
        setFormError('Please enter a valid email address.');
        setLoading(false);
        return;
      }
  
      try {
        const response = await fetch('/api/waiting-list/UploadUserData', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues)
        });
  
        const responseData = await response.json();
        if (response.status === 201) {
          navigate('/');
          setUser(responseData.user);
          setLoading(false);
        } else if (response.status === 200) {
          setSubmissionSuccess(true);
          setTimeout(() => { setLoading(false); setSubmissionSuccess(false); }, 2000);
        } else {
          setSubmissionError(true);
          setTimeout(() => { setLoading(false); setSubmissionError(false); }, 2000);
        }
      } catch (error) {
        console.error(error);
        setSubmissionError(true);
        setTimeout(() => { setLoading(false); setSubmissionError(false); }, 2000);
      }
    };


    return (
        <section className={`waiting-list ${mobileView && "mobile"}`}>
            {mobileView ? (
                <header className="header">
                    <h1 className="gigin-g">
                        g<span style={{ color: 'var(--gigin-orange)'}}>.</span>
                    </h1>
                    <nav>
                        <ul className="nav-list">
                            <li className="nav-item"><a href="#value">Value</a></li>
                            <li className="nav-item"><a href="#future">Scope</a></li>
                        </ul>
                    </nav>
                </header>
            ) : (
                <h1 className="gigin-g">
                    g<span style={{ color: 'var(--gigin-orange)'}}>.</span>
                </h1>
            )}
            <section className="hero">
                <div className="left">
                    <div className="word">
                        <h1>gigin<span style={{ color: 'var(--gigin-orange)'}}>.</span></h1>
                        <div className="word-info">
                            <p>[gig-in]</p>
                            <p>verb</p>
                            <DotIcon />
                            <p className="italic">English</p>
                        </div>
                    </div>
                    <div className="definition">
                        <p>To make it possible for <i>anyone</i> to book live music, <i>musicians</i> to get more gigs, and <i>everyone</i> to experience it.</p>
                    </div>
                </div>
                <div className="right">
                    <div className="head">
                        <h2>Redefining the future of live music.</h2>
                        <p>Be part of the movement and we’ll keep you up to date with gigin developments and release dates.</p>
                    </div>
                    <form className="form">
                        <div className="input-group">
                            <input 
                                type="text" 
                                id="name_1" 
                                name="name"
                                placeholder="Your name"
                                required
                                onChange={(event) => {handleInputChange(event); setFormError('')}}
                            />
                        </div>
                        <div className="input-group">
                            <input 
                                type="email" 
                                id="email_1" 
                                name="email"
                                placeholder="you@ilovemusic.com"
                                required
                                onChange={(event) => {handleInputChange(event); setFormError('')}}
                            />
                        </div>
                        <div className="radio-section">
                            <p>Who are you?</p>
                            <div className="radio-group">
                                <input type="radio" id="musician_1" name="type" value="musician" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                <label htmlFor="musician_1">I'm a musician</label>
                            </div>
                            <div className="radio-group">
                                <input type="radio" id="venue_1" name="type" value="venue" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                <label htmlFor="venue_1">I'm a venue/host</label>
                            </div>
                            <div className="radio-group">
                                <input type="radio" id="gig-goer_1" name="type" value="gig-goer" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                <label htmlFor="gig-goer_1">I'm a gig lover</label>
                            </div>
                            <div className="radio-group">
                                <input type="radio" id="interested_1" name="type" value="interested" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                <label htmlFor="interested_1">I'm just interested</label>
                            </div>
                        </div>
                        <button type="submit" className="btn" onClick={handleFormSubmission}>Join the Gigin Journey</button>
                        {formError && <p className="error" style={{ fontSize: '0.8em' }}>*{formError}</p>}
                    </form>
                </div>
            </section>
            <section className="body">
                <div className="value" id="value">
                    <h2>The Value<span style={{ color: 'var(--gigin-orange)'}}>.</span></h2>
                    <div className="item">
                        <div className="left">
                            <GuitarsIcon />
                            <h3>Musicians<span style={{ color: 'var(--gigin-orange)'}}>.</span></h3>
                        </div>
                        <div className="right">
                            <p>
                                The vision of Gigin was created by and for Musicians. We believe that there is so much talent out there that never sees the light of day due to the gatekeepers in the gigging business, or you do not earn as much money from your performing as you deserve. We believe you can find and book more gigs and better gigs - you just need the right system in place to take the stress of your shoulders. Find opportunities on the Gigin Map©, contact the hosts directly and negotiate fees and details on the Gigin Chat© and know that you are paid before you even step on to the stage. This really is the Gig revolution that musicians have been waiting for... 
                            </p>
                        </div>
                    </div>
                    <div className="item">
                        <div className="left">
                            <MicrophoneLinesIcon />
                            <h3>Venues (Hosts)<span style={{ color: 'var(--gigin-orange)'}}>.</span></h3>
                        </div>
                        <div className="right">
                            <p>
                                We’re rewriting the narrative of booking live music with Gigin, where we firmly believe that anyone should be able to do it. Inspired by the systems of Airbnb and Amazon, our webapp simplifies and secures the process. Whether you prefer to post your requirements and await applications or take a hands-on approach in finding musicians yourself, Gigin empowers you to curate and book your ideal live music experience. Whether you're a traditional music venue, a cozy pub, or someone looking to elevate your house party, Gigin is transforming the way live music is booked, doing it the way it should be done. 
                            </p>
                        </div>
                    </div>
                    <div className="item">
                        <div className="left">
                            <PeopleRoofIcon />
                            <h3>General public (gig-goers)<span style={{ color: 'var(--gigin-orange)'}}>.</span></h3>
                        </div>
                        <div className="right">
                            <p>
                                Live music gives us a feeling like nothing else can, yet it is something we  starve ourselves of. Find whats happening near you on the Gigin Map©, follow your favourite artists and never miss another incredible night out: Gigin is the ultimate live music companion you have been waiting for. We believe that special feeling should be one you experience regularly; we’ll just show you where to get it.                            </p>
                        </div>
                    </div>
                </div>
                <div className="future" id="future">
                    <div className="head">
                        <h2>The Future<span style={{ color: 'var(--gigin-orange)'}}>.</span></h2>
                        <p>This will be a global movement.</p>
                    </div>
                    <div className="features">
                        <div className="item">
                            <PeopleGroupIcon />
                            <h4>The Gigin band manager</h4>
                            <p>Manage payment splits, set lists and find new band members, or last-minute fill-ins to make sure your gig always goes ahead.</p>
                        </div>
                        <div className="item">
                            <CoinIcon />
                            <h4>Rewards for Gigin gig-goers</h4>
                            <p>Our ad revenue will be used to give you offers on drinks and tickets when you find gigs on Gigin. We want Gigin gig-goers to be treated like royalty.</p>
                        </div>
                        <div className="item">
                            <TutoringIcon />
                            <h4>Gigin Tutoring</h4>
                            <p>Whether you are looking to level up your performances, or  to share your knowledge as another revenue stream, we want to support all your music needs.</p>
                        </div>
                        <div className="item">
                            <ShieldIcon />
                            <h4>Our perfect match guarantee</h4>
                            <p>If you don’t think you got the value you were expecting from the music you booked, we pick up the cost and pay the gig fee back to you.</p>
                        </div>
                    </div>
                </div>
            </section>
            <section className="footer">
                <div className="left">
                    <h2>Music to your ears?</h2>
                    <p>Be part of the movement and we’ll keep you up to date with gigin developments and release dates.</p>
                </div>
                <div className="right">
                    <form className="form">
                        <div className="input-group">
                            <input 
                                type="text" 
                                id="name_2" 
                                name="name"
                                placeholder="Your name"
                                required
                                onChange={(event) => {handleInputChange(event); setFormError('')}}
                            />
                        </div>
                        <div className="input-group">
                            <input 
                                type="email" 
                                id="email_2" 
                                name="email"
                                placeholder="you@ilovemusic.com"
                                required
                                onChange={(event) => {handleInputChange(event); setFormError('')}}
                            />
                        </div>
                        <div className="radio-section">
                            <p>Who are you?</p>
                            <div className="horizontal">
                                <div className="radio-group">
                                    <input type="radio" id="musician_2" name="type" value="musician" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                    <label htmlFor="musician_2">I'm a musician</label>
                                </div>
                                <div className="radio-group">
                                    <input type="radio" id="venue_2" name="type" value="venue" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                    <label htmlFor="venue_2">I'm a venue/host</label>
                                </div>
                                <div className="radio-group">
                                    <input type="radio" id="gig-goer_2" name="type" value="gig-goer" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                    <label htmlFor="gig-goer_2">I'm a gig lover</label>
                                </div>
                                <div className="radio-group">
                                    <input type="radio" id="interested_2" name="type" value="interested" onChange={(event) => {handleInputChange(event); setFormError('')}} />
                                    <label htmlFor="interested_2">I'm just interested</label>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="btn" onClick={handleFormSubmission}>Join the Gigin Journey</button>
                    </form>
                </div>
            </section>
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-body">
                        {submissionSuccess ? (
                            <>
                                <SuccessIcon />
                                <p>Thank you for joining the Gigin Journey!</p>
                            </>
                        ) : submissionError ? (
                            <>
                                <ErrorIcon />
                                <p>Something went wrong. Please try again.</p>
                            </>
                        ) : (
                            <div className="loader"></div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};