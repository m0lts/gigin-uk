import { useRef, useEffect } from 'react';

export const NameStage = ({ data, onChange, user, band = false }) => {

    const nameInputRef = useRef(null);

    useEffect(() => {
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, []);

    return (
        <div className='stage name'>
            <div className='body'>
                <h2>{band === true ? "What's Your Band Called?" : "What's Your Stage Name?"}</h2>
                <input
                    className='input name'
                    type='text'
                    value={data}
                    onChange={(e) => onChange('name', e.target.value)}
                    ref={nameInputRef}
                />
                {!band && (
                    <button className='btn secondary' onClick={() => onChange('name', user.name)}>
                        Use Account Name
                    </button>
                )}
            </div>
        </div>
    );
};