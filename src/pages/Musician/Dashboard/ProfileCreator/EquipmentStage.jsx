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

export const EquipmentStage = ({ data, onChange, instruments }) => {
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
        <div className="stage">
            <h2>Stage 8: Equipment Required</h2>
            <div className="equipment-list">
                {requiredEquipment.map((equipment, index) => (
                    <div key={index} className="equipment-item">
                        <input
                            type="checkbox"
                            id={equipment}
                            name={equipment}
                            value={equipment}
                            checked={data.includes(equipment)}
                            onChange={() => handleCheckboxChange(equipment)}
                        />
                        <label htmlFor={equipment}>{equipment}</label>
                    </div>
                ))}
            </div>
        </div>
    );
};