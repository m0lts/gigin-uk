
export const ProgressBar = ({ currentStage, totalStages }) => {
    const section1Progress = () => {
        if (currentStage === 0) return 0; // No progress on the welcome stage
        if (currentStage <= 4) return (currentStage / 4) * 100;
        return 100;
    };

    const section2Progress = () => {
        if (currentStage <= 4) return 0;
        if (currentStage <= 10) return ((currentStage - 4) / 6) * 100;
        return 100;
    };

    const section3Progress = () => {
        if (currentStage <= 9) return 0;
        if (currentStage <= 14) return ((currentStage - 10) / 3) * 100;
        if (currentStage === 14) return 100;
        return 0;
    };

    return (
        <div className='progress-bar-container'>
            <div className='progress-bar-section'>
                <div className='progress-bar' style={{ width: `${section1Progress()}%` }}></div>
            </div>
            <div className='progress-bar-gap'></div>
            <div className='progress-bar-section'>
                <div className='progress-bar' style={{ width: `${section2Progress()}%` }}></div>
            </div>
            <div className='progress-bar-gap'></div>
            <div className='progress-bar-section'>
                <div className='progress-bar' style={{ width: `${section3Progress()}%` }}></div>
            </div>
        </div>
    );
};

