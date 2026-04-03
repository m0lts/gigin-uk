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
    SlidersIcon,
    UserIcon
} from '@features/shared/ui/extras/Icons';

const getEquipmentIcon = (equipmentName) => {
    const name = equipmentName.toLowerCase();
    if (name.includes('sound engineer')) {
        return <UserIcon />;
    }
    if (name.includes('stage monitor')) {
        return <SpeakersIcon />;
    }
    if (name.includes('pa') || name.includes('speaker')) {
        return <SpeakersIcon />;
    }
    if (name.includes('mixing') || name.includes('console') || name.includes('desk')) {
        return <SlidersIcon />;
    }
    if (name.includes('mic') || name.includes('microphone')) {
        return <MicrophoneIcon />;
    }
    if (name.includes('di') || name.includes('box')) {
        return <PlugIcon />;
    }
    if (name.includes('drum')) {
        return <DrumsIcon />;
    }
    if (name.includes('bass') && name.includes('amp')) {
        return <AmpIcon />;
    }
    if (name.includes('guitar') && name.includes('amp')) {
        return <AmpIcon />;
    }
    if (name.includes('keyboard') || name.includes('piano')) {
        return <PianoIcon />;
    }
    return <MicrophoneIcon />; // Default icon
};

export const TechRiderEquipmentCard = ({ equipmentName, available, count, notes, hireFee }) => {
    const isCountBased = count !== undefined && count !== null && count !== '';
    const isAvailable = isCountBased
        ? (parseInt(count, 10) > 0)
        : (available === 'yes' || available === true);
    
    const displayValue = isCountBased && parseInt(count, 10) > 0
        ? `×${count}`
        : null;
    const hireLabel = hireFee != null && hireFee !== '' ? `£${hireFee}` : null;

    return (
        <div className="tech-rider-equipment-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                <div className="tech-rider-equipment-icon">
                    {getEquipmentIcon(equipmentName)}
                </div>
                <h4 className="tech-rider-equipment-name">
                    {equipmentName}
                </h4>
                <div className="tech-rider-equipment-status">
                    {isAvailable ? (
                        <>
                            {hireLabel ? (
                                <span className="tech-rider-count">{hireLabel}</span>
                            ) : isCountBased && displayValue ? (
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
            {notes && (
                <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--gn-grey-300)', width: '100%' }}>
                    <p style={{ margin: 0, color: 'var(--gn-off-black)', lineHeight: 1.5 }}>{notes}</p>
                </div>
            )}
        </div>
    );
};

