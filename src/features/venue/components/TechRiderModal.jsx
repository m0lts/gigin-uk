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
  GuitarsIcon,
  WarningIcon,
  CloseIcon
} from '@features/shared/ui/extras/Icons';
import '@styles/artists/gig-page.styles.css';

// Instrument-specific question configurations (for tech rider display)
const INSTRUMENT_QUESTIONS = {
  'Vocals': [
    { key: 'needsMic', type: 'yesno', label: 'Needs mic provided?', notes: true },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Drums': [
    { key: 'needsDrumKit', type: 'yesno', label: 'Need drum kit provided?', notes: true },
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
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
  ],
  'Bass': [
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
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
    { key: 'bringingInstrument', type: 'yesno', label: 'Bringing instrument?', notes: false },
    { key: 'needsAmp', type: 'yesno', label: 'Need amp provided?', notes: true },
    { key: 'needsDI', type: 'yesno', label: 'Need DI?', notes: true },
    { key: 'singing', type: 'yesno', label: 'Singing?', notes: false },
    { key: 'needsMic', type: 'yesno', label: 'Mic Needed?', notes: true, dependsOn: { key: 'singing', value: true } },
    { key: 'needsPowerSockets', type: 'number', label: 'Need power socket(s)?', notes: true },
    { key: 'extraNotes', type: 'text', label: 'Extra notes' }
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
    default:
      return <PlaybackIcon />; // Default for 'Other'
  }
};

export const TechRiderModal = ({ techRider, artistName, venueTechRider, onClose }) => {
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
    return null;
  }

  // Helper function to get performer details for popup
  const getPerformerDetails = (performerIndex) => {
    const performer = techRider.lineup[performerIndex];
    const details = techRider.performerDetails?.[performerIndex] || {};
    const instruments = performer.instruments || [];
    
    const questionMap = new Map();
    const allQuestions = [];
    instruments.forEach((instrument) => {
      const questions = INSTRUMENT_QUESTIONS[instrument] || [];
      allQuestions.push(...questions.map(q => ({ ...q, instrument })));
    });
    
    const dependencyOnlyKeys = new Set();
    allQuestions.forEach(question => {
      if (!question.notes && question.type === 'yesno' && question.key !== 'extraNotes') {
        const isUsedAsDependency = allQuestions.some(q => q.dependsOn && q.dependsOn.key === question.key);
        if (isUsedAsDependency) {
          dependencyOnlyKeys.add(question.key);
        }
      }
    });
    
    instruments.forEach((instrument) => {
      const questions = INSTRUMENT_QUESTIONS[instrument] || [];
      const instrumentDetails = details[instrument] || {};
      
      questions.forEach((question) => {
        if (dependencyOnlyKeys.has(question.key)) {
          return;
        }
        
        if (question.dependsOn) {
          let dependencyMet = false;
          const dependsValue = instrumentDetails[question.dependsOn.key];
          if (dependsValue === question.dependsOn.value) {
            dependencyMet = true;
          } else {
            const existing = questionMap.get(question.key);
            if (existing) {
              for (const inst of existing.instruments) {
                const instDetails = details[inst] || {};
                if (instDetails[question.dependsOn.key] === question.dependsOn.value) {
                  dependencyMet = true;
                  break;
                }
              }
            }
          }
          if (!dependencyMet) {
            return;
          }
        }
        
        if (!questionMap.has(question.key)) {
          questionMap.set(question.key, {
            ...question,
            instruments: [instrument],
            currentValue: instrumentDetails[question.key],
            instrumentDetails: instrumentDetails,
            sourceInstrument: instrument
          });
        } else {
          const existing = questionMap.get(question.key);
          existing.instruments.push(instrument);
          if (existing.currentValue === undefined || existing.currentValue === null || existing.currentValue === '') {
            const thisValue = instrumentDetails[question.key];
            if (thisValue !== undefined && thisValue !== null && thisValue !== '') {
              existing.currentValue = thisValue;
              existing.instrumentDetails = instrumentDetails;
              existing.sourceInstrument = instrument;
            }
          }
        }
      });
    });

    const questions = Array.from(questionMap.values()).filter(q => {
      // Don't show "singing?" question if performer has Vocals in their instruments
      if (q.key === 'singing' && instruments.includes('Vocals')) {
        return false;
      }
      if (q.type === 'yesno') return q.currentValue !== undefined && q.currentValue !== null;
      if (q.type === 'number') return q.currentValue !== undefined && q.currentValue !== null && q.currentValue !== 0;
      if (q.type === 'text') return q.currentValue && q.currentValue.trim() !== '';
      return false;
    });

    // Separate into needs (red) and doesn't need (grey)
    const needsQuestions = [];
    const doesntNeedQuestions = [];
    
    questions.forEach((questionData) => {
      const question = questionData;
      const currentValue = questionData.currentValue;
      const isBringingInstrument = question.key === 'bringingInstrument' || question.key === 'bringingKeyboard';
      
      if (question.type === 'yesno') {
        // Special handling for bringingKeyboard: if false, it means they need keyboard provided
        if (question.key === 'bringingKeyboard' && !currentValue) {
          needsQuestions.push(questionData);
        } else if (currentValue && !isBringingInstrument) {
          needsQuestions.push(questionData);
        } else if (!currentValue || isBringingInstrument) {
          doesntNeedQuestions.push(questionData);
        }
      } else if (question.type === 'number' || question.type === 'text') {
        needsQuestions.push(questionData);
      }
    });

    return { needsQuestions, doesntNeedQuestions, performer, instruments };
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

  return (
    <div className='modal tech-rider-modal' onClick={onClose}>
      <div className='modal-content' onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
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
        
        <div className="additional-info-section" style={{ border: 'none', padding: 0 }}>
          <div className="section-content" style={{ padding: 0 }}>
            {/* Stage Map - View Only */}
            <div className="tech-rider-stage-map-container view-mode" style={{ position: 'relative' }}>
              <div className="tech-rider-stage-area view-mode" ref={stageAreaRef} style={{ position: 'relative' }}>
                <h6 className="tech-rider-stage-front">Front of Stage</h6>
                {techRider.stageArrangement?.performers?.map((performer) => {
                  const performerData = techRider.lineup[performer.lineupIndex];
                  if (!performerData) return null;
                  const primaryInstrument = performerData.instruments?.[0] || 'Other';
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
                        {getInstrumentIcon(primaryInstrument)}
                        <span className="tech-rider-stage-performer-name">
                          {performerData.performerName || `Performer ${performer.lineupIndex + 1}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performer Requirements List - Vertical */}
            <div className="tech-rider-viewer-performers-list">
              <div className="tech-rider-viewer-performers-vertical">
                {techRider.lineup.map((performer, index) => {
                  const details = techRider.performerDetails?.[index] || {};
                  const instruments = performer.instruments || [];
                  
                  // Collect all questions from all instruments, deduplicated
                  const questionMap = new Map();
                  
                  // First pass: collect all questions from all instruments to identify dependency-only questions
                  const allQuestions = [];
                  instruments.forEach((instrument) => {
                    const questions = INSTRUMENT_QUESTIONS[instrument] || [];
                    allQuestions.push(...questions.map(q => ({ ...q, instrument })));
                  });
                  
                  // Identify questions that are only used as dependencies
                  const dependencyOnlyKeys = new Set();
                  allQuestions.forEach(question => {
                    if (!question.notes && question.type === 'yesno' && question.key !== 'extraNotes') {
                      const isUsedAsDependency = allQuestions.some(q => q.dependsOn && q.dependsOn.key === question.key);
                      if (isUsedAsDependency) {
                        dependencyOnlyKeys.add(question.key);
                      }
                    }
                  });
                  
                  // Second pass: collect questions, filtering out dependency-only ones
                  instruments.forEach((instrument) => {
                    const questions = INSTRUMENT_QUESTIONS[instrument] || [];
                    const instrumentDetails = details[instrument] || {};
                    
                    questions.forEach((question) => {
                      // Skip dependency-only questions
                      if (dependencyOnlyKeys.has(question.key)) {
                        return;
                      }
                      
                      if (question.dependsOn) {
                        let dependencyMet = false;
                        const dependsValue = instrumentDetails[question.dependsOn.key];
                        if (dependsValue === question.dependsOn.value) {
                          dependencyMet = true;
                        } else {
                          const existing = questionMap.get(question.key);
                          if (existing) {
                            for (const inst of existing.instruments) {
                              const instDetails = details[inst] || {};
                              if (instDetails[question.dependsOn.key] === question.dependsOn.value) {
                                dependencyMet = true;
                                break;
                              }
                            }
                          }
                        }
                        if (!dependencyMet) {
                          return;
                        }
                      }
                      
                      if (!questionMap.has(question.key)) {
                        questionMap.set(question.key, {
                          ...question,
                          instruments: [instrument],
                          currentValue: instrumentDetails[question.key],
                          instrumentDetails: instrumentDetails,
                          sourceInstrument: instrument
                        });
                      } else {
                        const existing = questionMap.get(question.key);
                        existing.instruments.push(instrument);
                        if (existing.currentValue === undefined || existing.currentValue === null || existing.currentValue === '') {
                          const thisValue = instrumentDetails[question.key];
                          if (thisValue !== undefined && thisValue !== null && thisValue !== '') {
                            existing.currentValue = thisValue;
                            existing.instrumentDetails = instrumentDetails;
                            existing.sourceInstrument = instrument;
                          }
                        }
                      }
                    });
                  });

                  const questions = Array.from(questionMap.values()).filter(q => {
                    // Don't show "singing?" question if performer has Vocals in their instruments
                    if (q.key === 'singing' && instruments.includes('Vocals')) {
                      return false;
                    }
                    // Only show questions that have answers
                    if (q.type === 'yesno') return q.currentValue !== undefined && q.currentValue !== null;
                    if (q.type === 'number') return q.currentValue !== undefined && q.currentValue !== null && q.currentValue !== 0;
                    if (q.type === 'text') return q.currentValue && q.currentValue.trim() !== '';
                    return false;
                  });

                  // Separate questions into "needs" (red) and "doesn't need" (grey)
                  const needsQuestions = [];
                  const doesntNeedQuestions = [];
                  
                  questions.forEach((questionData) => {
                    const question = questionData;
                    const currentValue = questionData.currentValue;
                    const isBringingInstrument = question.key === 'bringingInstrument' || question.key === 'bringingKeyboard';
                    
                    if (question.type === 'yesno') {
                      // Special handling for bringingKeyboard: if false, it means they need keyboard provided
                      if (question.key === 'bringingKeyboard' && !currentValue) {
                        needsQuestions.push(questionData);
                      } else if (currentValue && !isBringingInstrument) {
                        needsQuestions.push(questionData);
                      } else if (!currentValue || isBringingInstrument) {
                        doesntNeedQuestions.push(questionData);
                      }
                    } else if (question.type === 'number' || question.type === 'text') {
                      needsQuestions.push(questionData);
                    }
                  });

                  return (
                    <div 
                      key={index} 
                      className="tech-rider-viewer-performer-box"
                      style={{ 
                        position: 'relative'
                      }}
                    >
                      <div className="tech-rider-viewer-performer-header">
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
                      
                      {questions.length > 0 ? (
                        <div className="tech-rider-viewer-performer-requirements">
                          {/* Red "needs" items at top */}
                          {needsQuestions.length > 0 && (
                            <div style={{ marginBottom: doesntNeedQuestions.length > 0 ? '0.75rem' : '0' }}>
                              {needsQuestions.map((questionData) => {
                                const question = questionData;
                                const currentValue = questionData.currentValue;
                                const instrumentDetails = questionData.instrumentDetails;
                                const notesValue = instrumentDetails[`${question.key}_notes`] || '';
                                const isBringingInstrument = question.key === 'bringingInstrument' || question.key === 'bringingKeyboard';
                                const isBringingKeyboardFalse = question.key === 'bringingKeyboard' && !currentValue;

                                return (
                                  <div key={question.key} className="tech-rider-viewer-requirement-item">
                                    {question.type === 'yesno' && (
                                      <span>
                                        {(() => {
                                          // Special handling for bringingKeyboard when false
                                          if (isBringingKeyboardFalse) {
                                            return <span style={{ color: 'var(--gn-red)' }}>Needs keyboard provided</span>;
                                          }
                                          let label = question.label.replace('?', '').trim();
                                          const lowerLabel = label.toLowerCase();
                                          if (lowerLabel.startsWith('need ') && !lowerLabel.startsWith('needs ')) {
                                            label = 'Needs ' + label.substring(5);
                                          }
                                          if (!isBringingInstrument) {
                                            return <span style={{ color: 'var(--gn-red)' }}>{label}</span>;
                                          } else {
                                            return <span>{label}</span>;
                                          }
                                        })()}
                                        {notesValue && <span className="tech-rider-viewer-notes"> ({notesValue})</span>}
                                      </span>
                                    )}
                                    {question.type === 'number' && (
                                      <span>
                                        <span style={{ color: 'var(--gn-red)' }}>Needs {currentValue} {currentValue === 1 ? 'power socket' : 'power sockets'}</span>
                                        {notesValue && <span className="tech-rider-viewer-notes"> ({notesValue})</span>}
                                      </span>
                                    )}
                                    {question.type === 'text' && (
                                      <span>
                                        <span style={{ color: 'var(--gn-red)' }}>{currentValue}</span>
                                        {notesValue && <span className="tech-rider-viewer-notes"> ({notesValue})</span>}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Grey "doesn't need" items at bottom */}
                          {doesntNeedQuestions.length > 0 && (
                            <div style={{ paddingTop: needsQuestions.length > 0 ? '0.75rem' : '0', borderTop: needsQuestions.length > 0 ? '1px solid var(--gn-grey-300)' : 'none' }}>
                              {doesntNeedQuestions.map((questionData) => {
                                const question = questionData;
                                const currentValue = questionData.currentValue;
                                const instrumentDetails = questionData.instrumentDetails;
                                const notesValue = instrumentDetails[`${question.key}_notes`] || '';

                                return (
                                  <div key={question.key} className="tech-rider-viewer-requirement-item" style={{ color: 'var(--gn-grey-700)' }}>
                                    {question.type === 'yesno' && (
                                      <span>
                                        {(() => {
                                          let label = question.label.replace('?', '').trim();
                                          const lowerLabel = label.toLowerCase();
                                          if (lowerLabel.startsWith('needs ')) {
                                            return "Doesn't need " + label.substring(6);
                                          } else if (lowerLabel.startsWith('need ')) {
                                            return "Doesn't need " + label.substring(5);
                                          } else if (lowerLabel.startsWith('bringing')) {
                                            return label;
                                          }
                                          return "Doesn't need " + label.toLowerCase();
                                        })()}
                                        {notesValue && <span className="tech-rider-viewer-notes"> ({notesValue})</span>}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
                <div className="tech-rider-viewer-extra-notes">
                  <h5 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Additional Notes</h5>
                  <p style={{ color: 'var(--gn-grey-700)', whiteSpace: 'pre-wrap' }}>
                    {techRider.extraNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Performer Details Popup */}
        {selectedPerformerIndex !== null && (() => {
          const { needsQuestions, doesntNeedQuestions, performer, instruments } = getPerformerDetails(selectedPerformerIndex);
          
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
              
              {(needsQuestions.length > 0 || doesntNeedQuestions.length > 0) ? (
                <div>
                  {/* Red "needs" items at top */}
                  {needsQuestions.length > 0 && (
                    <div style={{ marginBottom: doesntNeedQuestions.length > 0 ? '0.75rem' : '0' }}>
                      {needsQuestions.map((questionData) => {
                        const question = questionData;
                        const currentValue = questionData.currentValue;
                        const instrumentDetails = questionData.instrumentDetails;
                        const notesValue = instrumentDetails[`${question.key}_notes`] || '';
                        const isBringingInstrument = question.key === 'bringingInstrument' || question.key === 'bringingKeyboard';
                        const isBringingKeyboardFalse = question.key === 'bringingKeyboard' && !currentValue;

                        return (
                          <div key={question.key} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            {question.type === 'yesno' && (
                              <span>
                                {(() => {
                                  // Special handling for bringingKeyboard when false
                                  if (isBringingKeyboardFalse) {
                                    return <span style={{ color: 'var(--gn-red)' }}>Needs keyboard provided</span>;
                                  }
                                  let label = question.label.replace('?', '').trim();
                                  const lowerLabel = label.toLowerCase();
                                  if (lowerLabel.startsWith('need ') && !lowerLabel.startsWith('needs ')) {
                                    label = 'Needs ' + label.substring(5);
                                  }
                                  if (!isBringingInstrument) {
                                    return <span style={{ color: 'var(--gn-red)' }}>{label}</span>;
                                  } else {
                                    return <span>{label}</span>;
                                  }
                                })()}
                                {notesValue && <span style={{ color: 'var(--gn-grey-600)', fontStyle: 'italic', fontSize: '0.85rem' }}> ({notesValue})</span>}
                              </span>
                            )}
                            {question.type === 'number' && (
                              <span>
                                <span style={{ color: 'var(--gn-red)' }}>Needs {currentValue} {currentValue === 1 ? 'power socket' : 'power sockets'}</span>
                                {notesValue && <span style={{ color: 'var(--gn-grey-600)', fontStyle: 'italic', fontSize: '0.85rem' }}> ({notesValue})</span>}
                              </span>
                            )}
                            {question.type === 'text' && (
                              <span>
                                <span style={{ color: 'var(--gn-red)' }}>{currentValue}</span>
                                {notesValue && <span style={{ color: 'var(--gn-grey-600)', fontStyle: 'italic', fontSize: '0.85rem' }}> ({notesValue})</span>}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Grey "doesn't need" items at bottom */}
                  {doesntNeedQuestions.length > 0 && (
                    <div style={{ paddingTop: needsQuestions.length > 0 ? '0.75rem' : '0', borderTop: needsQuestions.length > 0 ? '1px solid var(--gn-grey-300)' : 'none' }}>
                      {doesntNeedQuestions.map((questionData) => {
                        const question = questionData;
                        const currentValue = questionData.currentValue;
                        const instrumentDetails = questionData.instrumentDetails;
                        const notesValue = instrumentDetails[`${question.key}_notes`] || '';

                        return (
                          <div key={question.key} style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--gn-grey-700)' }}>
                            {question.type === 'yesno' && (
                              <span>
                                {(() => {
                                  let label = question.label.replace('?', '').trim();
                                  const lowerLabel = label.toLowerCase();
                                  if (lowerLabel.startsWith('needs ')) {
                                    return "Doesn't need " + label.substring(6);
                                  } else if (lowerLabel.startsWith('need ')) {
                                    return "Doesn't need " + label.substring(5);
                                  } else if (lowerLabel.startsWith('bringing')) {
                                    // If bringing keyboard is false, show "Needs keyboard provided"
                                    if (question.key === 'bringingKeyboard' && !currentValue) {
                                      return "Needs keyboard provided";
                                    }
                                    return label;
                                  }
                                  return "Doesn't need " + label.toLowerCase();
                                })()}
                                {notesValue && <span style={{ color: 'var(--gn-grey-600)', fontStyle: 'italic', fontSize: '0.85rem' }}> ({notesValue})</span>}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--gn-grey-500)', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                  No specific requirements listed.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

