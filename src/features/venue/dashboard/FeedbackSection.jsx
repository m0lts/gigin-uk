import { useState } from 'react';
import { toast } from 'sonner';
import { submitUserFeedback } from '@services/client-side/reports';

export const FeedbackSection = ({ user }) => {
    const [feedback, setFeedback] = useState({
        feedback: '',
        user: user?.uid,
        date: Date.now(),
      });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmitFeedback = async () => {
        if (!feedback.feedback.trim()) {
          toast.error('Please enter some feedback.');
          return;
        }
    
        setSubmitting(true);
        try {
          await submitUserFeedback(feedback);
          toast.success('Thanks for your feedback!');
          setFeedback({
            feedback: '',
            user: user?.uid || null,
            date: Date.now(),
          });
        } catch (err) {
          console.error('Error submitting feedback:', err);
          toast.error('Something went wrong. Please try again.');
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <div className="feedback-section">
            <h3 className='feedback-header'>Help Shape the Future of Gigin.</h3>
            <p className='feedback-copy'>
                We're just getting started — and your voice genuinely matters. Whether you've spotted a bug, have a feature request, or just want to share your thoughts, we’d love to hear from you. Your feedback will directly guide what we build next and how we improve the experience for everyone.
            </p>          
            <textarea
            className="feedback-textarea"
            rows={5}
            placeholder="Write your feedback here..."
            value={feedback.feedback}
            onChange={(e) =>
              setFeedback((prev) => ({
                ...prev,
                feedback: e.target.value,
              }))
            }
          />
          <button className="btn primary" onClick={handleSubmitFeedback} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      );
};
