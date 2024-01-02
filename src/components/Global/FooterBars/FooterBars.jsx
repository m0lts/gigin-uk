import { BackFooterButton, EmptySubmitButton, NextFooterButton, SaveFooterButton } from "../Buttons/Buttons"
import './footer-bars.styles.css'

export const BackAndNextFooterBar = ({ stageNumber, setStageNumber, setNextButtonAvailable, nextButtonAvailable, setSaveButtonAvailable, saveButtonAvailable, userProfile }) => {

    return (
        <footer className={`footer-bar ${stageNumber < 1 ? 'right-flex' : ''}`}>
            {stageNumber > 0 && (
                <BackFooterButton 
                    stageNumber={stageNumber}
                    setStageNumber={setStageNumber}
                    setSaveButtonAvailable={setSaveButtonAvailable}
                />
            )}
            <NextFooterButton 
                stageNumber={stageNumber}
                setStageNumber={setStageNumber}
                setNextButtonAvailable={setNextButtonAvailable}
                nextButtonAvailable={nextButtonAvailable}
                saveButtonAvailable={saveButtonAvailable}
            />
            <SaveFooterButton
                setSaveButtonAvailable={setSaveButtonAvailable}
                saveButtonAvailable={saveButtonAvailable}
                userProfile={userProfile}
            />
        </footer>
    )
}