import { useState, useEffect } from 'react';
import Portal from '@features/shared/components/Portal';
import { TechRiderEquipmentCard } from '@features/shared/ui/tech-rider/TechRiderEquipmentCard';
import { WarningIcon, CloseIcon } from '@features/shared/ui/extras/Icons';
import { getVenueProfileById } from '@services/client-side/venues';
import { getArtistProfileById } from '@services/client-side/artists';
import '@styles/shared/modals.styles.css';
import '@styles/artists/gig-page.styles.css';
import { TechRiderIcon } from '../../../shared/ui/extras/Icons';

export const TechRiderModal = ({ isOpen, onClose, venueId, artistProfileId }) => {
  const [venueProfile, setVenueProfile] = useState(null);
  const [artistProfile, setArtistProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !venueId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [venue, artist] = await Promise.all([
          getVenueProfileById(venueId),
          artistProfileId ? getArtistProfileById(artistProfileId) : Promise.resolve(null),
        ]);
        setVenueProfile(venue);
        setArtistProfile(artist);
      } catch (error) {
        console.error('Error fetching tech rider data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, venueId, artistProfileId]);

  const checkTechRiderMismatches = () => {
    if (!artistProfile?.techRider || !venueProfile?.techRider) {
      return [];
    }

    const artistTechRider = artistProfile.techRider;
    const venueTechRider = venueProfile.techRider;
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
          const instrumentLower = instrument.toLowerCase();
          
          if (instrumentLower.includes('drum')) {
            if (details.Drums?.needsDrumKit) {
              artistNeeds.needsDrumKit = true;
            }
            if (details.Drums?.needsPA) artistNeeds.needsPA = true;
            if (details.Drums?.needsMixingConsole) artistNeeds.needsMixingConsole = true;
          }
          
          if (instrumentLower.includes('bass')) {
            artistNeeds.needsBassAmp = true;
            if (details.Bass?.needsPA) artistNeeds.needsPA = true;
            if (details.Bass?.needsMixingConsole) artistNeeds.needsMixingConsole = true;
          }
          
          if (instrumentLower.includes('guitar')) {
            artistNeeds.needsGuitarAmp = true;
            if (details.Guitar?.needsPA) artistNeeds.needsPA = true;
            if (details.Guitar?.needsMixingConsole) artistNeeds.needsMixingConsole = true;
          }
          
          if (instrumentLower.includes('keyboard') || instrumentLower.includes('piano') || instrumentLower.includes('keys')) {
            artistNeeds.needsKeyboard = true;
            if (details.Keyboard?.needsPA) artistNeeds.needsPA = true;
            if (details.Keyboard?.needsMixingConsole) artistNeeds.needsMixingConsole = true;
          }
          
          if (instrumentLower.includes('vocals')) {
            if (details.Vocals?.needsPA) artistNeeds.needsPA = true;
            if (details.Vocals?.needsMixingConsole) artistNeeds.needsMixingConsole = true;
          }
        });

        if (details.Vocals?.needsMic) {
          artistNeeds.needsMicCount += 1;
        }
        
        const performerDIBoxes = details.Drums?.needsDIBoxes || details.Bass?.needsDIBoxes || details.Guitar?.needsDIBoxes || details.Keyboard?.needsDIBoxes || 0;
        artistNeeds.needsDIBoxes += performerDIBoxes;
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
      return `The venue does not have ${equipmentNames[0]} available for use.`;
    } else if (equipmentNames.length === 2) {
      return `The venue does not have ${equipmentNames[0]} or ${equipmentNames[1]} available for use.`;
    } else {
      const lastItem = equipmentNames[equipmentNames.length - 1];
      const otherItems = equipmentNames.slice(0, -1).join(', ');
      return `The venue does not have ${otherItems}, or ${lastItem} available for use.`;
    }
  };

  const renderTechRider = () => {
    if (!venueProfile?.techRider) {
      return <p>The venue has not listed any tech rider information.</p>;
    }

    const { soundSystem, backline, houseRules } = venueProfile.techRider;
    const equipmentItems = [];
    const equipmentNotes = [];

    // PA
    if (soundSystem?.pa) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="pa"
          equipmentName="PA"
          available={soundSystem.pa.available}
        />
      );
      if (soundSystem.pa.notes) {
        equipmentNotes.push({ name: 'PA', notes: soundSystem.pa.notes });
      }
    }

    // Mixing Console
    if (soundSystem?.mixingConsole) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="mixingConsole"
          equipmentName="Mixing Console"
          available={soundSystem.mixingConsole.available}
        />
      );
      if (soundSystem.mixingConsole.notes) {
        equipmentNotes.push({ name: 'Mixing Console', notes: soundSystem.mixingConsole.notes });
      }
    }

    // Vocal Mics
    if (soundSystem?.vocalMics) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="vocalMics"
          equipmentName="Vocal Mics"
          count={soundSystem.vocalMics.count}
        />
      );
      if (soundSystem.vocalMics.notes) {
        equipmentNotes.push({ name: 'Vocal Mics', notes: soundSystem.vocalMics.notes });
      }
    }

    // DI Boxes
    if (soundSystem?.diBoxes) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="diBoxes"
          equipmentName="DI Boxes"
          count={soundSystem.diBoxes.count}
        />
      );
      if (soundSystem.diBoxes.notes) {
        equipmentNotes.push({ name: 'DI Boxes', notes: soundSystem.diBoxes.notes });
      }
    }

    // Drum Kit
    if (backline?.drumKit) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="drumKit"
          equipmentName="Drum Kit"
          available={backline.drumKit.available}
        />
      );
      if (backline.drumKit.notes) {
        equipmentNotes.push({ name: 'Drum Kit', notes: backline.drumKit.notes });
      }
    }

    // Bass Amp
    if (backline?.bassAmp) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="bassAmp"
          equipmentName="Bass Amp"
          available={backline.bassAmp.available}
        />
      );
      if (backline.bassAmp.notes) {
        equipmentNotes.push({ name: 'Bass Amp', notes: backline.bassAmp.notes });
      }
    }

    // Guitar Amp
    if (backline?.guitarAmp) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="guitarAmp"
          equipmentName="Guitar Amp"
          available={backline.guitarAmp.available}
        />
      );
      if (backline.guitarAmp.notes) {
        equipmentNotes.push({ name: 'Guitar Amp', notes: backline.guitarAmp.notes });
      }
    }

    // Keyboard
    if (backline?.keyboard) {
      equipmentItems.push(
        <TechRiderEquipmentCard
          key="keyboard"
          equipmentName="Keyboard"
          available={backline.keyboard.available}
        />
      );
      if (backline.keyboard.notes) {
        equipmentNotes.push({ name: 'Keyboard', notes: backline.keyboard.notes });
      }
    }

    return (
      <>
        <div className="tech-rider-grid">
          {equipmentItems}
        </div>
        
        {/* Volume Level and Noise Curfew */}
        {(houseRules?.volumeLevel || houseRules?.noiseCurfew) && (
          <div className="tech-rider-volume-curfew">
            {houseRules.volumeLevel && (
              <div className="tech-rider-volume-curfew-item">
                <h6>Volume Level</h6>
                <p>{houseRules.volumeLevel.charAt(0).toUpperCase() + houseRules.volumeLevel.slice(1)}</p>
                {houseRules.volumeNotes && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--gn-grey-600)', marginTop: '0.25rem' }}>{houseRules.volumeNotes}</p>
                )}
              </div>
            )}
            {houseRules.noiseCurfew && (
              <div className="tech-rider-volume-curfew-item">
                <h6>Noise Curfew</h6>
                <p>{houseRules.noiseCurfew}</p>
              </div>
            )}
          </div>
        )}

        {/* Equipment Notes */}
        {equipmentNotes.length > 0 && (
          <div className="tech-rider-notes-section">
            <h6>Equipment Notes</h6>
            {equipmentNotes.map((item, index) => (
              <div key={index}>
                <p><strong>{item.name}:</strong> {item.notes}</p>
              </div>
            ))}
          </div>
        )}

        {/* Other Note Fields */}
        {(soundSystem?.monitoring || soundSystem?.cables || backline?.other || backline?.stageSize || houseRules?.powerAccess || houseRules?.houseRules) && (
          <div className="tech-rider-notes-section">
            {soundSystem?.monitoring && (
              <div>
                <h6>Monitoring</h6>
                <p>{soundSystem.monitoring}</p>
              </div>
            )}
            {soundSystem?.cables && (
              <div>
                <h6>Cables</h6>
                <p>{soundSystem.cables}</p>
              </div>
            )}
            {backline?.other && (
              <div>
                <h6>Other Backline</h6>
                <p>{backline.other}</p>
              </div>
            )}
            {backline?.stageSize && (
              <div>
                <h6>Stage Size</h6>
                <p>{backline.stageSize}</p>
              </div>
            )}
            {houseRules?.powerAccess && (
              <div>
                <h6>Power Access</h6>
                <p>{houseRules.powerAccess}</p>
              </div>
            )}
            {houseRules?.houseRules && (
              <div>
                <h6>House Rules</h6>
                <p>{houseRules.houseRules}</p>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  if (!isOpen) return null;

  const mismatches = checkTechRiderMismatches();
  const warningText = formatTechRiderWarningText(mismatches);

  return (
    <Portal>
      <div className="modal" onClick={(e) => e.target.className === 'modal' && onClose()}>
        <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}>
          <button className="btn close danger" onClick={onClose}>
            Close
          </button>
          <div className="modal-header">
            <TechRiderIcon />
            <h2>Tech Rider</h2>
          </div>
          {loading ? (
            <p>Loading tech rider information...</p>
          ) : (
            <>
              {warningText && (
                <div className="tech-rider-warning" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
                  <WarningIcon />
                  <p>{warningText}</p>
                </div>
              )}
              {renderTechRider()}
            </>
          )}
        </div>
      </div>
    </Portal>
  );
};

