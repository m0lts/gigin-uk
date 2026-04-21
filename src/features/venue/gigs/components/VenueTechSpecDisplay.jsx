import '@styles/artists/gig-page.styles.css';
import { TechRiderEquipmentCard } from '@features/shared/ui/tech-rider/TechRiderEquipmentCard';
import { getVenueTechSpecPanelModel } from './venueTechSpecModel';

/**
 * Venue tech spec “all equipment” view — same structure as the artist-facing GigPage tech spec tab.
 */
export function VenueTechSpecDisplay({ techRider, hideNotes }) {
  if (!techRider) {
    return <p className="gig-page-tech-spec-empty">The venue has not listed any tech spec information.</p>;
  }

  const model = getVenueTechSpecPanelModel(techRider);
  if (!model) {
    return <p className="gig-page-tech-spec-empty">The venue has not listed any tech spec information.</p>;
  }

  const {
    soundItems,
    backlineItems,
    stageSetup,
    houseRules,
    hasStageAndPower,
    hasSoundLimits,
    hasTechnicalNotes,
  } = model;

  const renderItem = (item) => (
    <TechRiderEquipmentCard
      key={item.key}
      equipmentName={item.label}
      available={item.available}
      count={item.count}
      notes={item.notes}
      hireFee={item.hireFee}
      hideNotes={hideNotes}
    />
  );

  const specSectionTitleClass = 'venue-gig-page-sidebar__section-title venue-gig-page-sidebar__section-title--primary';

  return (
    <>
      {soundItems.length > 0 && (
        <div className="tech-spec-group" style={{ marginTop: '1rem' }}>
          <h4 className={specSectionTitleClass}>Sound</h4>
          <div className="tech-rider-grid" style={{ alignItems: 'flex-start' }}>
            {soundItems.map(renderItem)}
          </div>
        </div>
      )}
      {backlineItems.length > 0 && (
        <div className="tech-spec-group" style={{ marginTop: soundItems.length > 0 ? '1.25rem' : '1rem' }}>
          <h4 className={specSectionTitleClass}>Backline</h4>
          <div className="tech-rider-grid" style={{ alignItems: 'flex-start' }}>
            {backlineItems.map(renderItem)}
          </div>
        </div>
      )}
      {(hasStageAndPower || hasSoundLimits) && (
        <div className="tech-spec-venue-blocks-row" style={{ marginTop: '1.25rem' }}>
          {hasSoundLimits && (
            <div className="tech-spec-venue-block">
              <h4 className={specSectionTitleClass}>Sound limits</h4>
              <div className="tech-spec-venue-fields">
                {houseRules?.volumeLevel && (
                  <div className="tech-spec-venue-field">
                    <span className="tech-spec-venue-field-label">Volume level</span>
                    <span className="tech-spec-venue-field-value">
                      {String(houseRules.volumeLevel).charAt(0).toUpperCase() + String(houseRules.volumeLevel).slice(1)}
                    </span>
                  </div>
                )}
                {houseRules?.noiseCurfew && String(houseRules.noiseCurfew).trim() && (
                  <div className="tech-spec-venue-field">
                    <span className="tech-spec-venue-field-label">Noise curfew</span>
                    <span className="tech-spec-venue-field-value">{houseRules.noiseCurfew}</span>
                  </div>
                )}
                {!hideNotes && houseRules?.volumeNotes && String(houseRules.volumeNotes).trim() && (
                  <div className="tech-spec-venue-field">
                    <span className="tech-spec-venue-field-label">Volume notes</span>
                    <span className="tech-spec-venue-field-value">{houseRules.volumeNotes.trim()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {hasStageAndPower && (
            <div className="tech-spec-venue-block">
              <h4 className={specSectionTitleClass}>Stage & Power</h4>
              <div className="tech-spec-venue-fields">
                {stageSetup?.stageSize && String(stageSetup.stageSize).trim() && (
                  <div className="tech-spec-venue-field">
                    <span className="tech-spec-venue-field-label">Stage size</span>
                    <span className="tech-spec-venue-field-value">{stageSetup.stageSize.trim()}</span>
                  </div>
                )}
                {stageSetup?.powerOutlets != null && stageSetup.powerOutlets !== '' && (
                  <div className="tech-spec-venue-field">
                    <span className="tech-spec-venue-field-label">Power outlets on/near stage</span>
                    <span className="tech-spec-venue-field-value">{stageSetup.powerOutlets}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {!hideNotes && hasTechnicalNotes && (
        <div className="tech-spec-venue-block" style={{ marginTop: '1.25rem' }}>
          <h4 className={specSectionTitleClass}>Technical notes</h4>
          <p className="tech-spec-venue-notes">{stageSetup.generalTechNotes.trim()}</p>
        </div>
      )}
    </>
  );
}
