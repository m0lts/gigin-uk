import { useState } from 'react';
import { submitUserFeedback } from '../../../services/reports';
import { toast } from 'sonner';

export const FeedbackBox = ({ user, setShowWelcomeModal, setRevisitingModal }) => {
    const [mode, setMode] = useState('initial');
    const [feedback, setFeedback] = useState({
      feedback: '',
      user: user?.uid,
    });
  
    const handleClick = async () => {
      if (mode === 'initial') {
        setMode('input');
      } else if (mode === 'input') {
        try {
          await submitUserFeedback(feedback);
          setFeedback({ feedback: '', user: user?.uid });
          setMode('submitted');
          toast.success('Feedback received, thank you.');
          setTimeout(() => {
            setMode('initial')
          }, 2500);
        } catch (error) {
          toast.error('Feedback submission failed, please try again.')
        }
      }
    };
  
    return (
      <div className="feedback-outer-container">
        <button className="btn tertiary tutorial" onClick={() => {setShowWelcomeModal(true); setRevisitingModal(true)}}>
          Watch Dashboard Tutorial
        </button>
        <div className="feedback-container">
          <div className="feedback-header">
            <h3>Help us help you.</h3>
          </div>
          <div className="feedback-copy">
            {mode === 'initial' && (
              <p>We’ve just launched — your feedback can help shape the future of Gigin.</p>
            )}
            {mode === 'input' && (
              <textarea
                className="feedback-input"
                placeholder="Share your thoughts here..."
                value={feedback.feedback}
                onChange={(e) =>
                  setFeedback(prev => ({ ...prev, feedback: e.target.value }))
                }
              />
            )}
            {mode === 'submitted' && (
              <p>Thanks for your feedback! We really appreciate it.</p>
            )}
          </div>
          {mode !== 'submitted' && (
            mode === 'input' ? (
              <div className='two-buttons' style={{ justifyContent: 'space-between'}}>
                  <button className="btn primary" onClick={handleClick}>
                  {mode === 'initial' ? 'Give Feedback' : 'Send Feedback'}
                </button>
                <button className="btn secondary" onClick={() => setMode('initial')}>Close</button>
              </div>
            ) : (
              <button className="btn primary" onClick={handleClick}>
                {mode === 'initial' ? 'Give Feedback' : 'Send Feedback'}
              </button>
            )
          )}
        </div>
      </div>
    );
  };