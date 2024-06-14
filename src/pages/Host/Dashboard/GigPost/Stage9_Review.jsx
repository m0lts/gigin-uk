export const GigReview = ({ formData, handleInputChange }) => {

    const handleCheckboxChange = (e) => {
        const isChecked = e.target.checked;
        handleInputChange({
            privateApplications: isChecked,
        });
    };

    const formatMusic = (genres, type) => {
        if (!genres.length && type === '') return 'No Preferences';
        if (genres.length === 1) return `${genres[0]} ${type}`;
        if (genres.length === 2) return `${genres[0]} and ${genres[1]} ${type}`;
        return `${genres.slice(0, -1).join(', ')} and ${genres[genres.length - 1]} ${type}`;
    };
    
    const getOrdinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
        const month = date.toLocaleDateString('en-GB', { month: 'long' });
        return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
    };

    return (
        <>
            <div className="head">
                <h1>Review and Post</h1>
            </div>
            <div className="stage review">
                <p className="value">{formData.venueName}</p>
                <div className="review-grid">
                    <div className="review-left">
                        <div className="review-box">
                            <h4 className="label">Date</h4>
                            <p className="value">{formData.date ? formatDate(formData.date) : 'Date undecided'}</p>
                        </div>
                        <div className="review-box">
                            <h4 className="label">Start Time</h4>
                            <p className="value">{formData.startTime}</p>
                        </div>
                        <div className="review-box">
                            <h4 className="label">Duration</h4>
                            <p className="value">{formData.duration}</p>
                        </div>
                        <div className="review-box">
                            <h4 className="label">Budget</h4>
                            <p className="value">{formData.budget}</p>
                        </div>
                    </div>
                    <div className="review-right">
                        <div className="review-box">
                            <h4 className="label">Type</h4>
                            <p className="value">{formData.privacy} {formData.kind}</p>
                        </div>
                        <div className="review-box">
                            <h4 className="label">Music</h4>
                            <p className="value">{formatMusic(formData.genre, formData.musicType)}</p>
                        </div>
                        <div className="toggle-container">
                            <label htmlFor="private-applications" className="value">Make applications private?</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="private-applications"
                                    checked={formData.privateApplications}
                                    onChange={handleCheckboxChange}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <button className="btn secondary">Preview</button>
            </div>
        </>
    )
}