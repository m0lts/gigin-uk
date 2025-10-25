import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingThreeDots } from '@features/shared/ui/loading/Loading';
import '@styles/musician/testimonial-page.styles.css';
import '@styles/forms/forms.styles.css';
import { TextLogo } from '@features/shared/ui/logos/Logos';
import { submitTestimonial } from '@services/client-side/reviews';
import { LoadingSpinner } from '../../shared/ui/loading/Loading';

export const Testimonials = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const musicianId = queryParams.get('musicianId');
    const musicianName = queryParams.get('musicianName');

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!musicianId || !musicianName) {
            navigate('/');
        }
    }, [musicianId, musicianName]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        if (!title.trim() || !message.trim()) {
            alert('Please fill out both the title and message.');
            return;
        }
        try {
            await submitTestimonial(musicianId, { title, message });
            setTitle('');
            setMessage('');
            setSubmitted(true);
        } catch (error) {
            console.error('Error submitting testimonial:', error);
            alert('Failed to submit testimonial.');
        }
        setSubmitting(false);
    };

    return (
        <div className='testimonial-page'>
            <TextLogo />
            <h1>Testimonial Submission</h1>
            {submitting ? (
                <div className='submitting-testimonial'>
                    <h4>Submitting your testimonial...</h4>
                    <LoadingSpinner />
                </div>
            ) : (
                submitted ? (
                    <h4>Testimonial submitted successfully, thank you!</h4>
                ) : (
                    <div className='testimonial-body'>
                        {musicianId && (
                            <h3>
                                Submitting a testimonial for {musicianName}
                            </h3>
                        )}
                        <form className='form'>
                            <div className='input-group'>
                                <label htmlFor='title' className='label'>Title</label>
                                    <input
                                        id='title'
                                        type='text'
                                        className='input'
                                        placeholder='Enter the title of your testimonial'
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                    />
                            </div>
                            <div className='input-group'>
                                <label htmlFor='message' className='label'>Message</label>
                                    <textarea
                                        id='message'
                                        className='textarea'
                                        placeholder='Write your testimonial message here'
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows='5'
                                    />
                            </div>
                            <button className='btn primary' onClick={(e) => handleSubmit(e)}>
                                Submit Testimonial
                            </button>
                        </form>
                    </div>
                )
            )}
        </div>
    );
};