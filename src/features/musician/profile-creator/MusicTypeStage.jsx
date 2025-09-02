export const MusicTypeStage = ({ data, onChange }) => {

    const handleMusicTypeSelect = (value) => {
        onChange('musicType', value)
    }

    return (
        <div className='stage music-type'>
            <h3 className='section-title'>Music</h3>
            <div className='body'>
                <h1>Covers or Originals?</h1>
                <div className='selections'>
                    <div className={`card small ${data === 'Covers' ? 'selected' : ''}`} onClick={() => handleMusicTypeSelect('Covers')}>
                        <h4 className='text'>Covers</h4>
                    </div>
                    <div className={`card small ${data === 'Originals' ? 'selected' : ''}`} onClick={() => handleMusicTypeSelect('Originals')}>
                        <h4 className='text'>Originals</h4>
                    </div>
                    <div className={`card small ${data === 'Both' ? 'selected' : ''}`} onClick={() => handleMusicTypeSelect('Both')}>
                        <h4 className='text'>Both</h4>
                    </div>
                </div>   
            </div>
        </div>
    );
};