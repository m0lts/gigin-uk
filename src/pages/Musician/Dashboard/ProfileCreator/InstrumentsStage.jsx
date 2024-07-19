export const InstrumentsStage = ({ data, onChange, musicianType }) => {
    const instruments = {
        Musician: [
            'Guitar', 'Bass', 'Drums', 'Piano', 'Keyboard', 'Violin', 'Saxophone', 'Trumpet', 'Flute', 'Cello',
            'Harmonica', 'Banjo', 'Mandolin', 'Harp', 'Accordion'
        ],
        DJ: [
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
        <div className="stage">
            <h2>Stage 7: Instruments</h2>
            <div className="instruments-list">
                {instruments[musicianType].map((instrument, index) => (
                    <div key={index} className="instrument-item">
                        <input
                            type="checkbox"
                            id={instrument}
                            name={instrument}
                            value={instrument}
                            checked={data.includes(instrument)}
                            onChange={() => handleCheckboxChange(instrument)}
                        />
                        <label htmlFor={instrument}>{instrument}</label>
                    </div>
                ))}
            </div>
        </div>
    );
};