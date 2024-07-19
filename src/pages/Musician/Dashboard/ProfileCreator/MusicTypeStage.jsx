export const MusicTypeStage = ({ data, onChange }) => {
    const handleRadioChange = (e) => {
        onChange('musicType', e.target.value);
    };

    return (
        <div className="stage">
            <h2>Stage 6: Music Type</h2>
            <div>
                <input
                    type="radio"
                    id="covers"
                    name="musicType"
                    value="Covers"
                    checked={data === 'Covers'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="covers">Covers</label>
            </div>
            <div>
                <input
                    type="radio"
                    id="originals"
                    name="musicType"
                    value="Originals"
                    checked={data === 'Originals'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="originals">Originals</label>
            </div>
            <div>
                <input
                    type="radio"
                    id="both"
                    name="musicType"
                    value="Both"
                    checked={data === 'Both'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="both">Both</label>
            </div>
        </div>
    );
};