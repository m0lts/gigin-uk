const equipmentMapping = {
    Singer: ['Amplifier', 'Microphone', 'Microphone Stand'],
    Guitar: ['Amplifier', 'Guitar Stand'],
    Bass: ['Bass Amplifier', 'Bass Stand'],
    Drums: ['Drum Kit', 'Drum Sticks'],
    Piano: ['Piano Bench', 'Piano'],
    Keyboard: ['Keyboard Stand', 'Keyboard Amplifier'],
    Violin: ['Music Stand'],
    Saxophone: ['Music Stand'],
    Trumpet: ['Music Stand'],
    Flute: ['Music Stand'],
    Cello: ['Music Stand', 'Cello Stand'],
    Harmonica: ['Microphone'],
    Banjo: ['Banjo Stand'],
    Mandolin: ['Mandolin Stand'],
    Harp: ['Harp Stand'],
    Accordion: ['Accordion Stand'],
    Turntable: ['Turntable', 'Mixer'],
    Mixer: ['Mixer', 'Speakers'],
    Controller: ['Controller', 'Laptop Stand'],
    Synthesizer: ['Synthesizer Stand'],
    'Drum Machine': ['Drum Machine Stand'],
    Sampler: ['Sampler Stand'],
    Laptop: ['Laptop Stand'],
    Speakers: ['Speakers'],
    Headphones: ['Headphones'],
    Microphone: ['Microphone', 'Microphone Stand'],
    Lighting: ['Lighting'],
    'DJ Software': ['Laptop']
};

export const EquipmentStage = ({ data, onChange, instruments, band = false }) => {
    const getRequiredEquipment = (selectedInstruments) => {
        const requiredEquipment = new Set();
        selectedInstruments.forEach(instrument => {
            const equipment = equipmentMapping[instrument];
            if (equipment) {
                equipment.forEach(item => requiredEquipment.add(item));
            }
        });
        return Array.from(requiredEquipment);
    };

    const handleCheckboxChange = (equipment) => {
        if (data.includes(equipment)) {
            onChange('equipmentRequired', data.filter(item => item !== equipment));
        } else {
            onChange('equipmentRequired', [...data, equipment]);
        }
    };

    const requiredEquipment = getRequiredEquipment(instruments);

    return (
        <div className='stage equipment'>
            <h3 className='section-title'>Music</h3>
            <div className='body'>
                {band ? (
                    <h1>Select any equipment your band members <span style={{ textDecoration: 'underline', fontSize: '2rem' }}>can't</span> take to gigs with them.</h1>
                ) : (
                    <h1>Select any equipment you <span style={{ textDecoration: 'underline', fontSize: '2rem' }}>can't</span> take to gigs with you.</h1>
                )}
                <div className='equipment-list'>
                    {requiredEquipment.map((equipment, index) => (
                        <div key={index} className={`card small ${data.includes(equipment) ? 'selected' : ''}`} onClick={() => handleCheckboxChange(equipment)}>
                            {equipment}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};