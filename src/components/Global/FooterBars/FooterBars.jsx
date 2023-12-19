import { BackFooterButton, NextFooterButton } from "../Buttons/Buttons"
import './footer-bars.styles.css'

export const BackAndNextFooterBar = ({ stageNumber, setStageNumber, profileType, establishmentType, establishmentName, profileImages, inHouseEquipment, hostAddress }) => {

    return (
        <footer className={`footer-bar ${stageNumber < 1 ? 'right-flex' : ''}`}>
            {stageNumber > 0 && (
                <BackFooterButton 
                    stageNumber={stageNumber}
                    setStageNumber={setStageNumber}
                />
            )}
            <NextFooterButton 
                profileType={profileType}
                establishmentType={establishmentType}
                establishmentName={establishmentName}
                profileImages={profileImages}
                inHouseEquipment={inHouseEquipment}
                hostAddress={hostAddress}
                stageNumber={stageNumber}
                setStageNumber={setStageNumber}
            />
        </footer>
    )
}