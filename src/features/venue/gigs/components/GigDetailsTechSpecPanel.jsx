import { getEquipmentIconForLabel } from '@features/venue/utils/techSetupIcons';
import { getGigDetailsTechSpecModel } from './venueTechSpecModel';

/**
 * Single equipment row: icon + name (+ notes) on the left, status word + qty/hire fee on the right.
 * `available` is true/false; `count` is optional quantity; `hireFee` is optional number.
 */
function GigDetailsTechSpecRow({ item }) {
  const Icon = getEquipmentIconForLabel(item.label);
  const isHire = item.hireFee != null && item.hireFee !== '';
  const isAvailable = !!item.available;

  let statusClass;
  let statusLabel;
  if (!isAvailable) {
    statusClass = 'gig-details-tech-spec-row__status--unavailable';
    statusLabel = 'Unavailable';
  } else if (isHire) {
    statusClass = 'gig-details-tech-spec-row__status--hire';
    statusLabel = 'Needs Hire';
  } else {
    statusClass = 'gig-details-tech-spec-row__status--available';
    statusLabel = 'Available';
  }

  // Right-hand sub-line: hire fee for hire items, qty for count-based items, otherwise nothing
  let subLine = null;
  if (isHire) {
    subLine = `Hire fee £${item.hireFee}`;
  } else if (item.count != null && item.count !== '') {
    const n = parseInt(item.count, 10);
    if (Number.isFinite(n) && n > 0) subLine = `Qty: ${n}`;
  }

  return (
    <div className="gig-details-tech-spec-row">
      <span className={`gig-details-tech-spec-row__dot ${statusClass}`} aria-hidden />
      <div className="gig-details-tech-spec-row__main">
        <div className="gig-details-tech-spec-row__title-line">
          {Icon ? <Icon className="gig-details-tech-spec-row__icon" aria-hidden /> : null}
          <span className="gig-details-tech-spec-row__name">{item.label}</span>
        </div>
        {item.notes && String(item.notes).trim() ? (
          <p className="gig-details-tech-spec-row__notes">{String(item.notes).trim()}</p>
        ) : null}
      </div>
      <div className="gig-details-tech-spec-row__status-cell">
        <span className={`gig-details-tech-spec-row__status ${statusClass}`}>{statusLabel}</span>
        {subLine ? <span className="gig-details-tech-spec-row__sub">{subLine}</span> : null}
      </div>
    </div>
  );
}

function GigDetailsTechSpecGroup({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="gig-details-tech-spec-group">
      <h4 className="gig-details-tech-spec-group__title">{title}</h4>
      <div className="gig-details-tech-spec-group__items">
        {items.map((item) => (
          <GigDetailsTechSpecRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

/** Split gray tiles: sound details (left), stage details (right). */
function GigDetailsPhysicalDetails({ stageSetup, houseRules, hasStageAndPower, hasSoundLimits }) {
  if (!hasStageAndPower && !hasSoundLimits) return null;

  const stageDimensions =
    stageSetup?.stageSize && String(stageSetup.stageSize).trim()
      ? String(stageSetup.stageSize).trim()
      : null;
  const powerOutlets =
    stageSetup?.powerOutlets != null && stageSetup.powerOutlets !== ''
      ? String(stageSetup.powerOutlets)
      : null;

  const volumeLevel = houseRules?.volumeLevel
    ? String(houseRules.volumeLevel).charAt(0).toUpperCase() + String(houseRules.volumeLevel).slice(1)
    : null;
  const noiseCurfew =
    houseRules?.noiseCurfew && String(houseRules.noiseCurfew).trim()
      ? String(houseRules.noiseCurfew).trim()
      : null;
  const volumeNotes =
    houseRules?.volumeNotes && String(houseRules.volumeNotes).trim()
      ? String(houseRules.volumeNotes).trim()
      : null;

  return (
    <div className="gig-details-tech-spec-physical-split">
      {hasSoundLimits ? (
        <div className="gig-details-tech-spec-physical">
          <h4 className="gig-details-tech-spec-physical__title">Sound details</h4>
          <div className="gig-details-tech-spec-physical__col">
            {volumeLevel ? (
              <div className="gig-details-tech-spec-physical__field">
                <span className="gig-details-tech-spec-physical__label">Volume level</span>
                <span className="gig-details-tech-spec-physical__value">{volumeLevel}</span>
              </div>
            ) : null}
            {noiseCurfew ? (
              <div className="gig-details-tech-spec-physical__field">
                <span className="gig-details-tech-spec-physical__label">Noise curfew</span>
                <span className="gig-details-tech-spec-physical__value">{noiseCurfew}</span>
              </div>
            ) : null}
            {volumeNotes ? (
              <div className="gig-details-tech-spec-physical__field">
                <span className="gig-details-tech-spec-physical__label">Volume notes</span>
                <span className="gig-details-tech-spec-physical__value">{volumeNotes}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasStageAndPower ? (
        <div className="gig-details-tech-spec-physical">
          <h4 className="gig-details-tech-spec-physical__title">Stage details</h4>
          <div className="gig-details-tech-spec-physical__col">
            {stageDimensions ? (
              <div className="gig-details-tech-spec-physical__field">
                <span className="gig-details-tech-spec-physical__label">Stage size</span>
                <span className="gig-details-tech-spec-physical__value">{stageDimensions}</span>
              </div>
            ) : null}
            {powerOutlets ? (
              <div className="gig-details-tech-spec-physical__field">
                <span className="gig-details-tech-spec-physical__label">Power outlets</span>
                <span className="gig-details-tech-spec-physical__value">{powerOutlets}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Tech spec panel for the gig details Tech Setup tile.
 * Layout: Front of House → Stage → Backline → inner gray Stage & Sound Details tile.
 */
export function GigDetailsTechSpecPanel({ techRider }) {
  const model = getGigDetailsTechSpecModel(techRider);
  if (!model) {
    return <p className="gig-details-tech-spec-empty">The venue has not listed any tech spec information.</p>;
  }

  const { fohItems, stageItems, backlineItems, stageSetup, houseRules, hasStageAndPower, hasSoundLimits } = model;

  return (
    <div className="gig-details-tech-spec">
      <GigDetailsTechSpecGroup title="Front of House" items={fohItems} />
      <GigDetailsTechSpecGroup title="Stage" items={stageItems} />
      <GigDetailsTechSpecGroup title="Backline" items={backlineItems} />
      <GigDetailsPhysicalDetails
        stageSetup={stageSetup}
        houseRules={houseRules}
        hasStageAndPower={hasStageAndPower}
        hasSoundLimits={hasSoundLimits}
      />
    </div>
  );
}
