import { useState, useEffect } from 'react';
import './dynamic-text-box.styles.css';

export const DynamicTextBox = () => {

    const messages = [
        'Welcome to Gigin!',
        '£0 paid out to musicians.',
        '0 gigs needing musicians.',
        '0 total gig posts.'
    ];

    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex((prevIndex) =>
                prevIndex === messages.length - 1 ? 0 : prevIndex + 1
            );
        }, 5000);
        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <section className='dynamic-text-box'>
            <p className='dynamic-text'>{messages[currentMessageIndex]}</p>
        </section>
    )
}