export const InstrumentsStage = ({ data, onChange, musicianType, band = false }) => {
    const instruments = {
        'Musician': [
            'Singer', 'Guitar', 'Bass', 'Drums', 'Piano', 'Keyboard', 'Violin', 'Saxophone', 'Trumpet', 'Flute', 'Cello',
            'Harmonica', 'Banjo', 'Mandolin', 'Harp', 'Accordion'
        ],
        'Band': [
            'Singer', 'Guitar', 'Bass', 'Drums', 'Piano', 'Keyboard', 'Violin', 'Saxophone', 'Trumpet', 'Flute', 'Cello',
            'Harmonica', 'Banjo', 'Mandolin', 'Harp', 'Accordion'
        ],
        'DJ': [
            'Turntable', 'Mixer', 'Controller', 'Synthesizer', 'Drum Machine', 'Sampler', 'Laptop', 'Speakers',
            'Headphones', 'Microphone', 'Lighting', 'DJ Software'
        ]
    };

    const handleCheckboxChange = (instrument) => {
        if (data.includes(instrument)) {
            onChange('instruments', data.filter(item => item !== instrument));
        } else {
            onChange('instruments', [...data, instrument]);
        }
    };

    return (
        <div className='stage instruments'>
            <h3 className='section-title'>Music</h3>
            <div className='body'>
                {band ? (
                    <h1>What instruments do members of your band play?</h1>
                ) : (
                    <h1>What instruments do you {musicianType === 'DJ' ? 'use' : 'play'}?</h1>
                )}
                <div className='instruments-list'>
                    {instruments[musicianType].map((instrument, index) => (
                        <div key={index} className={`card small ${data.includes(instrument) ? 'selected' : ''}`} onClick={() => handleCheckboxChange(instrument)}>
                            {instrument}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};