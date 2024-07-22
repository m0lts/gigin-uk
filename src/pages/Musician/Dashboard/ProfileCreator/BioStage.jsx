export const BioStage = ({ data, onChange }) => {
    const handleTextChange = (e) => {
        onChange('bio', { ...data, text: e.target.value });
    };

    const handleSelectChange = (e) => {
        onChange('bio', { ...data, experience: e.target.value });
    };

    return (
        <div className="stage bio">
            <h3 className="section-title">Music</h3>
            <div className="body">
                <h1>Write a bio for your account.</h1>
                <textarea
                    value={data.text || ''}
                    onChange={handleTextChange}
                    placeholder="Write a bio about yourself and your music"
                />
                <select value={data.experience || ''} onChange={handleSelectChange} className="select">
                    <option value="">How long have you been performing gigs?</option>
                    <option value="less than 1 year">Less than 1 year</option>
                    <option value="1-2 years">1-2 years</option>
                    <option value="2-5 years">2-5 years</option>
                    <option value="5+ years">5+ years</option>
                </select>
            </div>
        </div>
    );
};