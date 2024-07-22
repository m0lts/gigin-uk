import { useState } from "react";
import { TickIcon } from "../../../../components/ui/Extras/Icons";

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
        <div className="stage final">
            <h3 className="section-title">Content</h3>
            <div className="body">
                <div className="title-container">
                    <h1>Let's finish up.</h1>
                    <p>To hit the ground running on Gigin, provide a couple emails to people who can testify to the quality of your performing.</p>
                </div>
                <div className="email-input">
                    {message1 ? (
                        <h4 className="message"><TickIcon /> {message1}</h4>
                    ) : (
                        <>
                            <input
                                type="email"
                                className="input"
                                value={email1}
                                onChange={(e) => setEmail1(e.target.value)}
                                placeholder="Enter first email address for testimonial"
                            />
                            <button className="btn primary-alt" onClick={() => handleSendEmail(email1, setMessage1)}>Send</button>
                        </>
                    )}
                </div>
                <div className="email-input">
                    {message2 ? (
                        <h4 className="message"><TickIcon /> {message2}</h4>
                    ) : (
                        <>
                            <input
                                type="email"
                                className="input"
                                value={email2}
                                onChange={(e) => setEmail2(e.target.value)}
                                placeholder="Enter second email address for testimonial"
                            />
                            <button className="btn primary-alt" onClick={() => handleSendEmail(email2, setMessage2)}>Send</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};