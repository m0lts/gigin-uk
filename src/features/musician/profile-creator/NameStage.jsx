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
            <h3 className='section-title'>{band === true ? 'Create Band' : 'Details'}</h3>
            <div className='body'>
                <h1>{band === true ? "What's Your Band Called?" : "What's Your Stage Name?"}</h1>
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