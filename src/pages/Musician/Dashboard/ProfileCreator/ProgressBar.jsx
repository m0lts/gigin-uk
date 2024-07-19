
export const ProgressBar = ({ currentStage, totalStages }) => {
    const calculateProgress = () => {
        if (currentStage === totalStages) return 100;
        if (currentStage <= 3) return (currentStage / 3) * 33.33;
        if (currentStage <= 9) return 33.33 + ((currentStage - 3) / 6) * 33.33;
        if (currentStage <= 12) return 66.66 + ((currentStage - 9) / 3) * 33.33;
        return 0;
    };

    const progress = currentStage === totalStages ? 100 : Math.min(calculateProgress(), 99.99);

    return (
        <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
    );
};

