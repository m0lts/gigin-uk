import { useState } from 'react';
import { TechRiderIcon, TickIcon, WarningIcon } from '@features/shared/ui/extras/Icons';
import { TechRiderModal } from './TechRiderModal';
import { computeCompatibility } from '@services/utils/techRiderCompatibility';
import { getEquipmentIconForLabel } from '@features/venue/utils/techSetupIcons';
import '@styles/artists/gig-page.styles.css';

const TAB_GIG_SETUP = 'gig-setup';
const TAB_TYPICAL_RIDER = 'typical-rider';

/** Compatibility status display for gig setup tab */
function CompatibilitySummary({ status, className = '' }) {
  if (!status) return null;
  const statusConfig = {
    fully_compatible: { label: 'Fully compatible', icon: TickIcon, class: 'applicant-tech-setup-compat--full' },
    compatible_with_hired: { label: 'Compatible with hired equipment/services', icon: TickIcon, class: 'applicant-tech-setup-compat--hired' },
    missing_required: { label: 'Missing equipment - needs discussion', icon: WarningIcon, class: 'applicant-tech-setup-compat--missing' },
  };
  const config = statusConfig[status] || statusConfig.missing_required;
  const Icon = config.icon;
  return (
    <div className={`applicant-tech-setup-compat ${config.class} ${className}`}>
      <Icon className="applicant-tech-setup-compat-icon" aria-hidden />
      <span>{config.label}</span>
    </div>
  );
}

/** Single section: title + list of items (with optional per-item icon) or "None selected" */
function SetupSection({ title, items, icon: Icon, emptyLabel = 'None selected', getItemIcon }) {
  const hasItems = Array.isArray(items) && items.length > 0;
  return (
    <div className="applicant-tech-setup-section">
      <h6 className="applicant-tech-setup-section-title">
        {Icon && <Icon className="applicant-tech-setup-section-icon" aria-hidden />}
        {title}
      </h6>
      {hasItems ? (
        <ul className="applicant-tech-setup-list">
          {items.map((item, i) => {
            const text = typeof item === 'string' ? item : (item?.label ?? item?.name ?? String(item));
            const ItemIcon = getItemIcon ? getItemIcon(text) : null;
            return (
              <li key={i} className="applicant-tech-setup-pill">
                {ItemIcon && <ItemIcon className="applicant-tech-setup-pill-icon" aria-hidden />}
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="applicant-tech-setup-empty">{emptyLabel}</p>
      )}
    </div>
  );
}

/** Tab 1: Setup for this gig – application-specific when saved, otherwise derived from artist rider + venue */
function GigSetupForShowTab({ application, techRider, venueTechRider, artistName }) {
  const techSetup = application?.techSetup || application;
  let usingVenue = techSetup?.usingVenueEquipment ?? [];
  let bringingOwn = techSetup?.bringingOwnEquipment ?? [];
  let hiringFromVenue = techSetup?.hiringFromVenue ?? [];
  let missingEquipment = techSetup?.missingEquipment ?? techSetup?.needsDiscussion ?? [];
  let setupNotes = techSetup?.setupNotes ?? '';
  let compatibilityStatus = techSetup?.compatibilityStatus ?? null;
  let isDerived = false;

  const hasApplicationData = (Array.isArray(usingVenue) && usingVenue.length > 0) ||
    (Array.isArray(bringingOwn) && bringingOwn.length > 0) ||
    (Array.isArray(hiringFromVenue) && hiringFromVenue.length > 0) ||
    (Array.isArray(missingEquipment) && missingEquipment.length > 0) ||
    (typeof setupNotes === 'string' && setupNotes.trim() !== '') ||
    compatibilityStatus;

  if (!hasApplicationData && techRider?.isComplete && techRider?.lineup?.length > 0 && venueTechRider) {
    const compat = computeCompatibility(techRider, venueTechRider);
    usingVenue = (compat.providedByVenue || []).map((i) => i?.label ?? i).filter(Boolean);
    bringingOwn = (compat.coveredByArtist || []).map((i) => i?.label ?? i).filter(Boolean);
    hiringFromVenue = (compat.hireableEquipment || []).map((i) =>
      typeof i === 'string' ? i : (i?.label ? (i.hireFee != null ? `${i.label} — £${i.hireFee}` : i.label) : String(i))
    ).filter(Boolean);
    missingEquipment = (compat.needsDiscussion || []).map((i) => {
      const label = i?.label ?? i ?? '';
      const note = i?.note && String(i.note).trim() ? ` — ${i.note}` : '';
      return typeof label === 'string' ? `${label}${note}` : String(label);
    }).filter(Boolean);
    const hasNeedsDiscussion = (compat.needsDiscussion?.length ?? 0) > 0;
    compatibilityStatus = hasNeedsDiscussion ? 'missing_required' : (hiringFromVenue.length > 0 ? 'compatible_with_hired' : 'fully_compatible');
    isDerived = true;
  }

  const hasAnyData = (Array.isArray(usingVenue) && usingVenue.length > 0) ||
    (Array.isArray(bringingOwn) && bringingOwn.length > 0) ||
    (Array.isArray(hiringFromVenue) && hiringFromVenue.length > 0) ||
    (Array.isArray(missingEquipment) && missingEquipment.length > 0) ||
    (typeof setupNotes === 'string' && setupNotes.trim() !== '') ||
    compatibilityStatus;

  if (!hasAnyData) {
    return (
      <div className="applicant-tech-setup-empty-state">
        <p>No setup information available for this application.</p>
        <p className="applicant-tech-setup-empty-state-hint">The artist&apos;s typical tech rider is in the other tab.</p>
      </div>
    );
  }

  const usingVenueItems = Array.isArray(usingVenue) ? usingVenue : [];
  const bringingOwnItems = Array.isArray(bringingOwn) ? bringingOwn : [];
  const hiringItems = Array.isArray(hiringFromVenue) ? hiringFromVenue : [];
  const missingItems = Array.isArray(missingEquipment) ? missingEquipment : [];

  return (
    <div className="applicant-tech-setup-tab-content">
      {compatibilityStatus && (
        <CompatibilitySummary status={compatibilityStatus} className="applicant-tech-setup-compat-summary" />
      )}
      <SetupSection title="Using venue equipment" items={usingVenueItems} emptyLabel="None" getItemIcon={getEquipmentIconForLabel} />
      <SetupSection title="Bringing own equipment" items={bringingOwnItems} emptyLabel="Instruments only" getItemIcon={getEquipmentIconForLabel} />
      <SetupSection title="Hiring from venue" items={hiringItems} emptyLabel="None" getItemIcon={getEquipmentIconForLabel} />
      {missingItems.length > 0 && (
        <div className="applicant-tech-setup-missing-tile">
          <SetupSection title="Missing required equipment" items={missingItems} emptyLabel="None" getItemIcon={getEquipmentIconForLabel} />
        </div>
      )}
      {setupNotes && setupNotes.trim() && (
        <div className="applicant-tech-setup-section">
          <h6 className="applicant-tech-setup-section-title">Notes for this show</h6>
          <p className="applicant-tech-setup-notes">{setupNotes.trim()}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Tabbed modal: Tab 1 = Setup for this gig (application), Tab 2 = Full Tech Rider (profile).
 * @param {Object} props
 * @param {Object} props.techRider - Artist profile tech rider (for tab 2)
 * @param {string} props.artistName
 * @param {Object} props.venueTechRider - Venue tech rider (for tab 2 comparison)
 * @param {Object} [props.application] - Application/applicant object; may contain techSetup: { usingVenueEquipment, bringingOwnEquipment, hiringFromVenue, setupNotes, compatibilityStatus }
 * @param {Function} props.onClose
 */
export function ApplicantTechSetupModal({ techRider, artistName, venueTechRider, application, onClose }) {
  const [activeTab, setActiveTab] = useState(TAB_GIG_SETUP);

  const hasTypicalRider = techRider?.isComplete && techRider?.lineup?.length > 0;

  return (
    <div className="modal tech-rider-modal applicant-tech-setup-modal" onClick={onClose}>
      <div className="modal-content scrollable applicant-tech-setup-modal__content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <button type="button" className="btn tertiary close" onClick={onClose} style={{ padding: '0.5rem', alignSelf: 'flex-end' }}>
          Close
        </button>
        <div className="applicant-tech-setup-modal__header">
          <div className="applicant-tech-setup-modal__header-inner">
            <TechRiderIcon aria-hidden />
            <h2 className="applicant-tech-setup-modal__title">Tech setup – {artistName}</h2>
          </div>
        </div>

        <div className="tech-spec-tabs applicant-tech-setup-tabs">
          <button
            type="button"
            className={`tech-spec-tab applicant-tech-setup-tab ${activeTab === TAB_GIG_SETUP ? 'tech-spec-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_GIG_SETUP)}
          >
            Setup for this gig
          </button>
          <button
            type="button"
            className={`tech-spec-tab applicant-tech-setup-tab ${activeTab === TAB_TYPICAL_RIDER ? 'tech-spec-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_TYPICAL_RIDER)}
          >
            Full Tech Rider
          </button>
        </div>

        <div className="tech-spec-tab-content applicant-tech-setup-tab-panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {activeTab === TAB_GIG_SETUP && (
            <GigSetupForShowTab application={application} techRider={techRider} venueTechRider={venueTechRider} artistName={artistName} />
          )}
          {activeTab === TAB_TYPICAL_RIDER && (
            hasTypicalRider ? (
              <TechRiderModal
                embed
                techRider={techRider}
                artistName={artistName}
                venueTechRider={venueTechRider}
              />
            ) : (
              <div className="applicant-tech-setup-empty-state">
                <p>No typical tech rider added yet.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
