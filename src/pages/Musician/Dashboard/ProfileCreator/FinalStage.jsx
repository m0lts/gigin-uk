import { useState } from "react";

export const FinalStage = () => {
    const [email1, setEmail1] = useState('');
    const [email2, setEmail2] = useState('');
    const [message1, setMessage1] = useState('');
    const [message2, setMessage2] = useState('');

    const handleSendEmail = async (email, setMessage) => {
        // try {
        //     const response = await fetch('https://your-cloud-function-url/sendEmail', {
        //         method: 'POST',
        //         headers: {
        //             'Content-Type': 'application/json'
        //         },
        //         body: JSON.stringify({ email })
        //     });

        //     if (response.ok) {
        //         setMessage(`Email sent to ${email}`);
        //     } else {
        //         setMessage('Failed to send email.');
        //     }
        // } catch (error) {
        //     console.error('Error sending email:', error);
        //     setMessage('Error sending email.');
        // }
        setMessage(`Email sent to ${email}`);
    };

    return (
        <div className="stage">
            <h2>Stage 12: Final</h2>
            <div className="email-inputs">
                <div className="email-input">
                    {message1 ? (
                        <p>{message1}</p>
                    ) : (
                        <>
                            <input
                                type="email"
                                value={email1}
                                onChange={(e) => setEmail1(e.target.value)}
                                placeholder="Enter first email address for testimonial"
                            />
                            <button onClick={() => handleSendEmail(email1, setMessage1)}>Send</button>
                        </>
                    )}
                </div>
                <div className="email-input">
                    {message2 ? (
                        <p>{message2}</p>
                    ) : (
                        <>
                            <input
                                type="email"
                                value={email2}
                                onChange={(e) => setEmail2(e.target.value)}
                                placeholder="Enter second email address for testimonial"
                            />
                            <button onClick={() => handleSendEmail(email2, setMessage2)}>Send</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};