import { BackFooterButton, NextFooterButton } from "../Buttons/Buttons"
import './footer-bars.styles.css'

export const BackAndNextFooterBar = ({ stageNumber, setStageNumber, profileType, establishmentType }) => {
    return (
        <footer className="footer-bar">
            <BackFooterButton 
                stageNumber={stageNumber}
                setStageNumber={setStageNumber}
            />
            <NextFooterButton 
                profileType={profileType}
                establishmentType={establishmentType}
                stageNumber={stageNumber}
                setStageNumber={setStageNumber}
            />
        </footer>
    )
}