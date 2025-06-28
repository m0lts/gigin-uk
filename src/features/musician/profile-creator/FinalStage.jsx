import { useState } from 'react';
import { ErrorIcon, TickIcon } from '@features/shared/ui/extras/Icons';
import { sendEmail } from '@services/emails';

export const FinalStage = ({ musicianName, musicianId }) => {
    const [email1, setEmail1] = useState('');
    const [email2, setEmail2] = useState('');
    const [message1, setMessage1] = useState(null);
    const [message2, setMessage2] = useState(null);

    const handleSendEmail = async (email, setMessage) => {
        try {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                setMessage({
                    type: 'error',
                    message: 'Invalid email address. Please enter a valid email.'
                });
                setTimeout(() => {
                    setMessage(null);
                }, 2000);
                return;
            }
            await sendEmail({
                to: email,
                subject: `Gigin Testimonial Request From ${musicianName}`,
                text: `${musicianName} has asked if you could provide a testimonial for them on gigin.`,
                html: `
                  <p>${musicianName} has asked if you could provide a testimonial for them on Gigin.</p>
                  <p>You can provide your testimonial by clicking the link below:</p>
                  <a href='https://gigin.ltd/testimonials?musicianId=${musicianId}&musicianName=${musicianName}' target='_blank'>Provide Testimonial</a>
                `,
              });
            setMessage({
                type: 'success',
                message: `Email sent to ${email}`,
            });
        } catch (error) {
            console.error('Error sending email:', error);
            setMessage({
                type: 'error',
                message: 'Error sending email. Please try again later.',
            });
        }
    };

    return (
        <div className='stage final'>
            <h3 className='section-title'>Content</h3>
            <div className='body'>
                <div className='title-container'>
                    <h1>Let's finish up.</h1>
                    <p>To hit the ground running on Gigin, provide a couple emails to people who can testify to the quality of your performing.</p>
                </div>
                <div className='email-input'>
                    {message1 ? (
                        message1.type === 'error' ? (
                            <h4 className='message error'><ErrorIcon />{message1.message}</h4>
                        ) : (
                            <h4 className='message'><TickIcon /> {message1.message}</h4>
                        )
                    ) : (
                        <>
                            <input
                                type='email'
                                className='input'
                                value={email1}
                                onChange={(e) => setEmail1(e.target.value)}
                                placeholder='Enter first email address for testimonial'
                            />
                            <button className='btn primary' onClick={() => handleSendEmail(email1, setMessage1)}>Send</button>
                        </>
                    )}
                </div>
                <div className='email-input'>
                    {message2 ? (
                        message2.type === 'error' ? (
                            <h4 className='message error'><ErrorIcon />{message2.message}</h4>
                        ) : (
                            <h4 className='message'><TickIcon /> {message2.message}</h4>
                        )
                    ) : (
                        <>
                            <input
                                type='email'
                                className='input'
                                value={email2}
                                onChange={(e) => setEmail2(e.target.value)}
                                placeholder='Enter second email address for testimonial'
                            />
                            <button className='btn primary' onClick={() => handleSendEmail(email2, setMessage2)}>Send</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};