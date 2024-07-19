export const MusicianTypeStage = ({ data, onChange }) => {
    const handleRadioChange = (e) => {
        onChange('musicianType', e.target.value);
    };

    return (
        <div className="stage">
            <h2>Stage 4: Musician Type</h2>
            <div>
                <input
                    type="radio"
                    id="musician"
                    name="musicianType"
                    value="Musician"
                    checked={data === 'Musician'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="musician">Musician</label>
            </div>
            <div>
                <input
                    type="radio"
                    id="dj"
                    name="musicianType"
                    value="DJ"
                    checked={data === 'DJ'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="dj">DJ</label>
            </div>
        </div>
    );
};