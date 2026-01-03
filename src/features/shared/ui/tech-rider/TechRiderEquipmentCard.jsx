import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/pro-solid-svg-icons';
import { faXmarkCircle } from '@fortawesome/pro-regular-svg-icons';
import { 
    SpeakersIcon, 
    AmpIcon, 
    PlugIcon, 
    MicrophoneIcon,
    PianoIcon,
    DrumsIcon,
    ClubIcon
} from '@features/shared/ui/extras/Icons';

const getEquipmentIcon = (equipmentName) => {
    const name = equipmentName.toLowerCase();
    if (name.includes('pa') || name.includes('speaker')) {
        return <SpeakersIcon />;
    } else if (name.includes('mixing') || name.includes('console') || name.includes('desk')) {
        return <ClubIcon />;
    } else if (name.includes('mic') || name.includes('microphone')) {
        return <MicrophoneIcon />;
    } else if (name.includes('di') || name.includes('box')) {
        return <PlugIcon />;
    } else if (name.includes('drum')) {
        return <DrumsIcon />;
    } else if (name.includes('bass') && name.includes('amp')) {
        return <AmpIcon />;
    } else if (name.includes('guitar') && name.includes('amp')) {
        return <AmpIcon />;
    } else if (name.includes('keyboard') || name.includes('piano')) {
        return <PianoIcon />;
    }
    return <MicrophoneIcon />; // Default icon
};

export const TechRiderEquipmentCard = ({ equipmentName, available, count }) => {
    const isCountBased = count !== undefined;
    const isAvailable = isCountBased
        ? (count !== '' && count !== null && count !== '0' && parseInt(count) > 0)
        : (available === 'yes');
    
    const displayValue = isCountBased && count !== '' && count !== null && count !== '0' && parseInt(count) > 0
        ? `×${count}`
        : null;

    return (
        <div className="tech-rider-equipment-card">
            <div className="tech-rider-equipment-icon">
                {getEquipmentIcon(equipmentName)}
            </div>
            <div className="tech-rider-equipment-name">
                {equipmentName}
            </div>
            <div className="tech-rider-equipment-status">
                {isAvailable ? (
                    <>
                        {isCountBased && displayValue ? (
                            <span className="tech-rider-count">{displayValue}</span>
                        ) : (
                            <FontAwesomeIcon 
                                icon={faCheckCircle} 
                                className='icon' 
                                style={{ color: 'var(--gn-green)' }} 
                            />
                        )}
                    </>
                ) : (
                    <FontAwesomeIcon 
                        icon={faXmarkCircle} 
                        className='icon' 
                        style={{ color: 'var(--gn-red)' }} 
                    />
                )}
            </div>
        </div>
    );
};

