import { BackFooterButton, EmptySubmitButton, NextFooterButton } from "../Buttons/Buttons"
import './footer-bars.styles.css'

export const BackAndNextFooterBar = ({ stageNumber, setStageNumber }) => {

    return (
        <footer className={`footer-bar ${stageNumber < 1 ? 'right-flex' : ''}`}>
            {stageNumber > 0 && (
                <BackFooterButton 
                    stageNumber={stageNumber}
                    setStageNumber={setStageNumber}
                />
            )}
            <NextFooterButton 
                stageNumber={stageNumber}
                setStageNumber={setStageNumber}
            />
        </footer>
    )
}