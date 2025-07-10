import { useState } from 'react';
import { submitUserFeedback } from '../../../services/reports';

export const FeedbackBox = ({ user }) => {
    const [mode, setMode] = useState('initial');
    const [feedback, setFeedback] = useState({
      feedback: '',
      user: user?.uid,
    });
  
    const handleClick = async () => {
      if (mode === 'initial') {
        setMode('input');
      } else if (mode === 'input') {
        await submitUserFeedback(feedback);
        console.log('Feedback submitted:', feedback);
        setFeedback({ feedback: '', user: user?.uid });
        setMode('submitted');
      }
    };
  
    return (
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
          <button className="btn primary" onClick={handleClick}>
            {mode === 'initial' ? 'Give Feedback' : 'Send Feedback'}
          </button>
        )}
      </div>
    );
  };