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
  WarningIcon
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
  if (!techRider || !techRider.isComplete || !techRider.lineup || techRider.lineup.length === 0) {
    return null;
  }

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
    
    const equipmentNames = mismatches.map(mismatch => {
      const cleaned = mismatch.split('(')[0].trim().toLowerCase();
      if (cleaned.includes('pa system')) return 'a PA system';
      if (cleaned.includes('mixing console')) return 'a mixing console';
      if (cleaned.includes('vocal mics')) return 'microphones';
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
          <div className="tech-rider-warning" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
            <WarningIcon />
            <p>{warningText}</p>
          </div>
        )}
        
        <div className="additional-info-section" style={{ border: 'none', padding: 0 }}>
          <div className="section-content" style={{ padding: 0 }}>
            {/* Stage Map - View Only */}
            <div className="tech-rider-stage-map-container view-mode">
              <div className="tech-rider-stage-area view-mode">
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
                      <div className="tech-rider-stage-performer-content">
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

            {/* Performer Requirements List */}
            <div className="tech-rider-viewer-performers-list">
              <div className="tech-rider-viewer-performers-grid">
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
                    // Only show questions that have answers
                    if (q.type === 'yesno') return q.currentValue !== undefined && q.currentValue !== null;
                    if (q.type === 'number') return q.currentValue !== undefined && q.currentValue !== null && q.currentValue !== 0;
                    if (q.type === 'text') return q.currentValue && q.currentValue.trim() !== '';
                    return false;
                  });

                  return (
                    <div key={index} className="tech-rider-viewer-performer-card">
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
                          {questions.map((questionData) => {
                            const question = questionData;
                            const currentValue = questionData.currentValue;
                            const instrumentDetails = questionData.instrumentDetails;
                            const notesValue = instrumentDetails[`${question.key}_notes`] || '';

                            return (
                              <div key={question.key} className="tech-rider-viewer-requirement-item">
                                {question.type === 'yesno' && (
                                  <span>
                                    {(() => {
                                      // Clean up the label - remove question mark
                                      let label = question.label.replace('?', '').trim();
                                      
                                      // Normalize to "Needs" format (only if it starts with "Need " not "Needs ")
                                      const lowerLabel = label.toLowerCase();
                                      if (lowerLabel.startsWith('need ') && !lowerLabel.startsWith('needs ')) {
                                        label = 'Needs ' + label.substring(5);
                                      }
                                      
                                      if (currentValue) {
                                        return <span style={{ color: 'var(--gn-red)' }}>{label}</span>;
                                      } else {
                                        // Convert to negative - remove "Needs " or "Need " prefix
                                        if (lowerLabel.startsWith('needs ')) {
                                          return "Doesn't need " + label.substring(6);
                                        } else if (lowerLabel.startsWith('need ')) {
                                          return "Doesn't need " + label.substring(5);
                                        }
                                        return "Doesn't need " + label.toLowerCase();
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
      </div>
    </div>
  );
};

