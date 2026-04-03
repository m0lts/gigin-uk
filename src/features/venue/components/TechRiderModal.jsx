import { useState, useRef, useEffect } from 'react';
import { 
  TechRiderIcon,
  VocalsIcon,
  DrumsIcon,
  KeysIcon,
  BassIcon,
  SaxIcon,
  TrumpetIcon,
  TromboneIcon,
  PlaybackIcon,
  MusicianIconSolid,
  GuitarsIcon,
  WarningIcon,
  CloseIcon,
  MicrophoneLinesIcon,
  PlugIcon,
  SpeakersIcon,
  SlidersIcon,
  AmpIcon,
  LinkIcon,
  PeopleGroupIconSolid
} from '@features/shared/ui/extras/Icons';
import '@styles/artists/gig-page.styles.css';
import { MoreInformationIcon } from '../../shared/ui/extras/Icons';
import { formatEquipmentSourceLine, getEquipmentSummary, getPerformerSummaryLines } from '@services/utils/techRiderSummary';

// Instrument-specific question configurations for tech rider display (must match artist schema for summary)
const INSTRUMENT_QUESTIONS = {
  'Vocals': [
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Drums': [
    { key: 'drumKitSource', type: 'source', label: 'Drum kit', options: [{ value: 'venue', label: 'Use venue kit' }, { value: 'own', label: 'Bring my own kit' }, { value: 'either', label: 'Either works' }] },
    { key: 'needsCymbals', type: 'yesno', label: 'Need cymbals provided?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Keys': [
    { key: 'bringingKeyboard', type: 'yesno', label: 'Bringing keyboard?', notes: false },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'needsKeyboardStand', type: 'yesno', label: 'Need keyboard stand provided?', notes: true },
    { key: 'hasSeat', type: 'yesno', label: 'Need seat provided?', notes: false },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Guitar': [
    { key: 'guitarAmpSource', type: 'source', label: 'Guitar amp', options: [{ value: 'venue', label: 'Use venue amp' }, { value: 'own', label: 'Bring my own amp' }, { value: 'either', label: 'Either works' }] },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Bass': [
    { key: 'bassAmpSource', type: 'source', label: 'Bass amp', options: [{ value: 'venue', label: 'Use venue amp' }, { value: 'own', label: 'Bring my own amp' }, { value: 'either', label: 'Either works' }] },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Tenor Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Alto Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Soprano Sax': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Trumpet': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Trombone': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Need mic provided? (in case horns need amplification)', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMicForSinging', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Other': [
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Needs DI box?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Power sockets needed on stage', notes: true }
  ],
  'Playback': [
    { key: 'hasPrerecordedSounds', type: 'yesno', label: 'Have pre-recorded sounds?', notes: false },
    { key: 'bringingLaptopPhone', type: 'yesno', label: 'Bringing laptop/phone and connectivity?', notes: false, dependsOn: { key: 'hasPrerecordedSounds', value: true } },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ]
};

// Get icon component for an instrument
const getInstrumentIcon = (instrument) => {
  switch (instrument) {
    case 'Vocals':
      return <VocalsIcon />;
    case 'Drums':
      return <DrumsIcon />;
    case 'Keys':
      return <KeysIcon />;
    case 'Guitar':
      return <GuitarsIcon />;
    case 'Bass':
      return <BassIcon />;
    case 'Tenor Sax':
    case 'Alto Sax':
    case 'Soprano Sax':
      return <SaxIcon />;
    case 'Trumpet':
      return <TrumpetIcon />;
    case 'Trombone':
      return <TromboneIcon />;
    case 'Playback':
      return <PlaybackIcon />;
    case 'Other':
      return <MusicianIconSolid />;
    default:
      return <PlaybackIcon />;
  }
};

export const TechRiderModal = ({ techRider, artistName, venueTechRider, onClose, embed = false }) => {
  const [selectedPerformerIndex, setSelectedPerformerIndex] = useState(null);
  const [performerPopupPosition, setPerformerPopupPosition] = useState({ top: 0, left: 0 });
  const stageAreaRef = useRef(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectedPerformerIndex !== null) {
        // Only close if clicking outside the popup and not on a stage performer
        const popup = document.querySelector('.tech-rider-performer-popup');
        const stagePerformer = e.target.closest('.tech-rider-stage-performer-content');
        
        if (popup && !popup.contains(e.target) && !stagePerformer) {
          setSelectedPerformerIndex(null);
        }
      }
    };
    if (selectedPerformerIndex !== null) {
      // Use mousedown to catch clicks before they propagate
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedPerformerIndex]);

  if (!techRider || !techRider.isComplete || !techRider.lineup || techRider.lineup.length === 0) {
    return embed ? null : null;
  }

  // Helper: get performer summary lines for popup (venue-focused, positive requirements only)
  const getPerformerDetails = (performerIndex) => {
    const performer = techRider.lineup[performerIndex];
    const details = techRider.performerDetails?.[performerIndex] || {};
    const instruments = performer.instruments || [];
    const summaryLines = getPerformerSummaryLines(details, instruments, INSTRUMENT_QUESTIONS);
    return { summaryLines, performer, instruments };
  };

  const checkTechRiderMismatches = () => {
    if (!techRider || !venueTechRider) {
      return [];
    }

    const artistTechRider = techRider;
    const mismatches = [];

    const artistNeeds = {
      needsDrumKit: false,
      needsBassAmp: false,
      needsGuitarAmp: false,
      needsKeyboard: false,
      needsMicCount: 0,
      needsDIBoxes: 0,
      needsPA: false,
      needsMixingConsole: false,
    };

    if (artistTechRider.lineup && artistTechRider.performerDetails) {
      artistTechRider.lineup.forEach((performer, index) => {
        const details = artistTechRider.performerDetails[index];
        if (!details) return;

        const instruments = performer.instruments || [];
        
        instruments.forEach(instrument => {
          const instrumentDetails = details[instrument] || {};
          const instrumentLower = instrument.toLowerCase();
          
          if (instrumentLower.includes('drum')) {
            if (instrumentDetails.needsDrumKit) {
              artistNeeds.needsDrumKit = true;
            }
            // Assume drums need PA and mixing console if they need a drum kit
            if (instrumentDetails.needsDrumKit) {
              artistNeeds.needsPA = true;
              artistNeeds.needsMixingConsole = true;
            }
          }
          
          if (instrumentLower.includes('bass')) {
            if (instrumentDetails.needsAmp) {
              artistNeeds.needsBassAmp = true;
              artistNeeds.needsPA = true;
              artistNeeds.needsMixingConsole = true;
            }
          }
          
          if (instrumentLower.includes('guitar')) {
            if (instrumentDetails.needsAmp) {
              artistNeeds.needsGuitarAmp = true;
              artistNeeds.needsPA = true;
              artistNeeds.needsMixingConsole = true;
            }
          }
          
          if (instrumentLower.includes('keyboard') || instrumentLower.includes('piano') || instrumentLower.includes('keys')) {
            // Keys always need PA/mixing console if they need DI or keyboard stand
            if (instrumentDetails.needsDI || instrumentDetails.needsKeyboardStand) {
              artistNeeds.needsKeyboard = true;
              artistNeeds.needsPA = true;
              artistNeeds.needsMixingConsole = true;
            }
          }
          
          if (instrumentLower.includes('vocals')) {
            if (instrumentDetails.needsMic || instrumentDetails.needsMicStand) {
              artistNeeds.needsPA = true;
              artistNeeds.needsMixingConsole = true;
            }
          }

          // Count mics needed
          if (instrumentDetails.needsMic) {
            artistNeeds.needsMicCount += 1;
          }
          
          // Count DI boxes needed
          if (instrumentDetails.needsDI) {
            artistNeeds.needsDIBoxes += 1;
          }
        });
      });
    }

    // Compare with venue availability
    if (artistNeeds.needsPA && venueTechRider.soundSystem?.pa?.available === 'no') {
      mismatches.push('PA System');
    }

    if (artistNeeds.needsMixingConsole && venueTechRider.soundSystem?.mixingConsole?.available === 'no') {
      mismatches.push('Mixing Console');
    }

    if (artistNeeds.needsMicCount > 0) {
      const venueMicCount = parseInt(venueTechRider.soundSystem?.vocalMics?.count || '0');
      if (venueMicCount < artistNeeds.needsMicCount) {
        mismatches.push(`Vocal Mics (need ${artistNeeds.needsMicCount}, venue has ${venueMicCount})`);
      }
    }

    if (artistNeeds.needsDIBoxes > 0) {
      const venueDIBoxCount = parseInt(venueTechRider.soundSystem?.diBoxes?.count || '0');
      if (venueDIBoxCount < artistNeeds.needsDIBoxes) {
        mismatches.push(`DI Boxes (need ${artistNeeds.needsDIBoxes}, venue has ${venueDIBoxCount})`);
      }
    }

    if (artistNeeds.needsDrumKit && venueTechRider.backline?.drumKit?.available === 'no') {
      mismatches.push('Drum Kit');
    }

    if (artistNeeds.needsBassAmp && venueTechRider.backline?.bassAmp?.available === 'no') {
      mismatches.push('Bass Amp');
    }

    if (artistNeeds.needsGuitarAmp && venueTechRider.backline?.guitarAmp?.available === 'no') {
      mismatches.push('Guitar Amp');
    }

    if (artistNeeds.needsKeyboard && venueTechRider.backline?.keyboard?.available === 'no') {
      mismatches.push('Keyboard');
    }
    
    return mismatches;
  };

  const formatTechRiderWarningText = (mismatches) => {
    if (mismatches.length === 0) return '';
    
    // Check if any mismatch is microphone-related
    const isMicrophoneMismatch = (mismatch) => {
      const cleaned = mismatch.split('(')[0].trim().toLowerCase();
      return cleaned.includes('vocal mics') || cleaned.includes('microphone') || cleaned.includes('mic');
    };
    
    const hasMicrophoneMismatch = mismatches.some(isMicrophoneMismatch);
    
    // If only microphones are missing, use special format
    if (hasMicrophoneMismatch && mismatches.length === 1) {
      return 'You do not have enough microphones available for use.';
    }
    
    const equipmentNames = mismatches.map(mismatch => {
      const cleaned = mismatch.split('(')[0].trim().toLowerCase();
      if (cleaned.includes('pa system')) return 'a PA system';
      if (cleaned.includes('mixing console')) return 'a mixing console';
      if (cleaned.includes('vocal mics') || cleaned.includes('microphone') || cleaned.includes('mic')) return 'enough microphones';
      if (cleaned.includes('di boxes')) return 'DI boxes';
      if (cleaned.includes('drum kit')) return 'a drum kit';
      if (cleaned.includes('bass amp')) return 'a bass amp';
      if (cleaned.includes('guitar amp')) return 'a guitar amp';
      if (cleaned.includes('keyboard')) return 'a keyboard';
      return `a ${cleaned}`;
    });

    if (equipmentNames.length === 1) {
      return `You do not have ${equipmentNames[0]} available for use.`;
    } else if (equipmentNames.length === 2) {
      return `You do not have ${equipmentNames[0]} or ${equipmentNames[1]} available for use.`;
    } else {
      const lastItem = equipmentNames[equipmentNames.length - 1];
      const otherItems = equipmentNames.slice(0, -1).join(', ');
      return `You do not have ${otherItems}, or ${lastItem} available for use.`;
    }
  };

  const mismatches = venueTechRider ? checkTechRiderMismatches() : [];
  const warningText = formatTechRiderWarningText(mismatches);

  const innerContent = (
    <>
      {!embed && (
        <>
          <button className='btn tertiary close' onClick={onClose} style={{ padding: '0.5rem' }}>
            Close
          </button>
          <div className='modal-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TechRiderIcon />
              <h2>Tech Rider - {artistName}</h2>
            </div>
          </div>
          {warningText && (
            <div className="tech-rider-warning" style={{ marginTop: 0, marginBottom: '1.5rem', maxWidth: '400px' }}>
              <WarningIcon />
              <p>{warningText}</p>
            </div>
          )}
        </>
      )}
      <div className="additional-info-section" style={{ border: 'none', padding: 0 }}>
        <div className="section-content" style={{ padding: 0 }}>
            {/* Equipment Summary - aggregated across all performers */}
            {(() => {
              const { performerCount, items } = getEquipmentSummary(techRider);
              const getEquipmentIcon = (type) => {
                const map = {
                  vocalMics: MicrophoneLinesIcon,
                  diBoxes: LinkIcon,
                  powerSockets: PlugIcon,
                  pa: SpeakersIcon,
                  mixingDesk: SlidersIcon,
                  drumKit: DrumsIcon,
                  guitarAmp: AmpIcon,
                  bassAmp: BassIcon
                };
                const Icon = map[type];
                return Icon ? <Icon /> : null;
              };
              return (
                <>
                  <h5 className="tech-rider-equipment-summary-title" style={{ marginBottom: '0.5rem' }}>Equipment Summary</h5>
                  <div className="tech-rider-equipment-summary" style={{ marginBottom: '1rem' }}>
                  <p className="tech-rider-equipment-summary-performers">
                    <span className="tech-rider-equipment-summary-performers-icon" aria-hidden><PeopleGroupIconSolid /></span>
                    Number of performers: {performerCount}
                  </p>
                  {items.length > 0 ? (
                    <ul className="tech-rider-equipment-summary-list" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                      {items.map((item, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="tech-rider-equipment-summary-item-icon" aria-hidden style={{ display: 'inline-flex', width: '1.125rem', flexShrink: 0 }}>{getEquipmentIcon(item.type)}</span>
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  </div>
                </>
              );
            })()}

            {/* Stage Map - View Only */}
            <div className="tech-rider-stage-map-container view-mode" style={{ position: 'relative' }}>
              <h5 className="tech-rider-equipment-summary-title" style={{ marginBottom: '0.5rem' }}>Stage Layout</h5>
              <div className="tech-rider-stage-area view-mode" ref={stageAreaRef} style={{ position: 'relative' }}>
                <h6 className="tech-rider-stage-front">Front of Stage</h6>
                {techRider.stageArrangement?.performers?.map((performer) => {
                  const performerData = techRider.lineup[performer.lineupIndex];
                  if (!performerData) return null;
                  const instruments = performerData.instruments?.length ? performerData.instruments : ['Other'];
                  return (
                    <div
                      key={performer.lineupIndex}
                      className="tech-rider-stage-performer"
                      style={{
                        left: `${performer.x}%`,
                        top: `${performer.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div 
                        className="tech-rider-stage-performer-content"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (stageAreaRef.current) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const modalContent = e.currentTarget.closest('.modal-content');
                            const modalRect = modalContent?.getBoundingClientRect();
                            if (modalRect) {
                              setPerformerPopupPosition({
                                top: rect.top,
                                left: rect.left
                              });
                              setSelectedPerformerIndex(performer.lineupIndex);
                            }
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="info-icon">
                          <MoreInformationIcon />
                        </div>
                        <div className="tech-rider-stage-performer-icons" aria-hidden>
                          {instruments.map((inst, idx) => (
                            <span key={idx} className="tech-rider-stage-performer-icon">{getInstrumentIcon(inst)}</span>
                          ))}
                        </div>
                        <span className="tech-rider-stage-performer-name">
                          {performerData.performerName || `Performer ${performer.lineupIndex + 1}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performer Requirements List - venue-focused summary */}
            <h5 className="tech-rider-equipment-summary-title" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Requirements per performer</h5>
            <div className="tech-rider-viewer-performers-list">
              <div className="tech-rider-viewer-performers-vertical">
                {techRider.lineup.map((performer, index) => {
                  const details = techRider.performerDetails?.[index] || {};
                  const instruments = performer.instruments || [];
                  const summaryLines = getPerformerSummaryLines(details, instruments, INSTRUMENT_QUESTIONS);
                  const hasAny = summaryLines.length > 0;

                  return (
                    <div key={index} className="tech-rider-viewer-performer-box" style={{ position: 'relative' }}>
                      <div className="tech-rider-viewer-performer-header">
                        {instruments.length > 0 && (
                          <span className="tech-rider-viewer-performer-header-icons" aria-hidden>
                            {instruments.map((inst, instIdx) => (
                              <span key={instIdx} className="tech-rider-viewer-performer-header-icon">{getInstrumentIcon(inst)}</span>
                            ))}
                          </span>
                        )}
                        <span className="tech-rider-viewer-performer-name">
                          {performer.performerName || `Performer ${index + 1}`}
                        </span>
                        <span className="tech-rider-viewer-performer-separator">·</span>
                        <span className="tech-rider-viewer-performer-instruments-inline">
                          {instruments.map((inst, instIdx) => (
                            <span key={instIdx}>
                              {instIdx > 0 && ', '}
                              {inst}
                            </span>
                          ))}
                        </span>
                      </div>
                      {hasAny ? (
                        <div className="tech-rider-viewer-performer-requirements">
                          {summaryLines.map((line, lineIndex) => (
                            <div key={lineIndex} className="tech-rider-viewer-requirement-item">
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="tech-rider-viewer-no-requirements">No specific requirements listed.</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Extra Notes */}
              {techRider.extraNotes && techRider.extraNotes.trim() !== '' && (
                <>
                  <h5 className="tech-rider-equipment-summary-title" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Additional Notes</h5>
                  <div className="tech-rider-viewer-extra-notes">
                    <p style={{ color: 'var(--gn-grey-700)', whiteSpace: 'pre-wrap', margin: 0 }}>
                      {techRider.extraNotes}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Performer Details Popup */}
        {selectedPerformerIndex !== null && (() => {
          const { summaryLines, performer, instruments } = getPerformerDetails(selectedPerformerIndex);
          const hasAny = summaryLines.length > 0;

          return (
            <div 
              className="tech-rider-performer-popup"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${performerPopupPosition.top - 10}px`,
                left: `${performerPopupPosition.left}px`,
                zIndex: 1001,
                background: 'var(--gn-white)',
                border: '1px solid var(--gn-grey-300)',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
                padding: '1rem',
                minWidth: '250px',
                maxWidth: '400px',
                transform: 'translateY(-100%)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', flex: 1 }}>
                  {performer.performerName || `Performer ${selectedPerformerIndex + 1}`}
                  {instruments.length > 0 && (
                    <span style={{ color: 'var(--gn-grey-700)', fontWeight: 500, marginLeft: '0.5rem' }}>
                      · {instruments.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              {hasAny ? (
                <div>
                  {summaryLines.map((line, lineIndex) => (
                    <div key={lineIndex} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--gn-grey-500)', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                  No specific requirements listed.
                </p>
              )}
            </div>
          );
        })()}
    </>
  );

  if (embed) {
    return <div className="tech-rider-modal-embed" style={{ padding: 0 }}>{innerContent}</div>;
  }
  return (
    <div className='modal tech-rider-modal' onClick={onClose}>
      <div className='modal-content scrollable' onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', maxHeight: '90vh', overflow: 'auto' }}>
        {innerContent}
      </div>
    </div>
  );
};

