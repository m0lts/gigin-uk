import { getTechRiderForDisplay } from '@features/venue/builder/techRiderConfig';

export const TECH_SPEC_SOUND_KEYS = new Set(['pa', 'mixingConsole', 'soundEngineer', 'microphones', 'micStands', 'diBoxes', 'stageMonitors']);
export const TECH_SPEC_BACKLINE_KEYS = new Set(['drumKit', 'bassAmp', 'guitarAmp', 'keyboard', 'keyboardStand', 'stageLighting', 'djDecks']);

/** Gig details tile uses a finer-grained 3-group split (FOH / Stage / Backline). */
export const TECH_SPEC_GIG_DETAILS_FOH_KEYS = new Set(['pa', 'mixingConsole', 'soundEngineer']);
export const TECH_SPEC_GIG_DETAILS_STAGE_KEYS = new Set(['stageMonitors', 'microphones', 'micStands', 'diBoxes']);
export const TECH_SPEC_GIG_DETAILS_BACKLINE_KEYS = TECH_SPEC_BACKLINE_KEYS;

/**
 * Normalised venue tech rider content for full + compact gig-page displays.
 * @returns {null | Object} null if no rider or nothing to show
 */
export function getVenueTechSpecPanelModel(techRider) {
  if (!techRider) return null;

  const { equipmentForDisplay, stageSetup, houseRules } = getTechRiderForDisplay(techRider);
  const soundItems = equipmentForDisplay.filter((item) => TECH_SPEC_SOUND_KEYS.has(item.key));
  const backlineItems = equipmentForDisplay.filter((item) => TECH_SPEC_BACKLINE_KEYS.has(item.key));

  const hasStageAndPower =
    (stageSetup?.stageSize && String(stageSetup.stageSize).trim()) ||
    (stageSetup?.powerOutlets != null && stageSetup.powerOutlets !== '');
  const hasSoundLimits =
    houseRules?.volumeLevel ||
    (houseRules?.noiseCurfew && String(houseRules.noiseCurfew).trim()) ||
    (houseRules?.volumeNotes && String(houseRules.volumeNotes).trim());
  const hasTechnicalNotes = stageSetup?.generalTechNotes && String(stageSetup.generalTechNotes).trim();

  const hasAnyContent =
    soundItems.length > 0 ||
    backlineItems.length > 0 ||
    hasStageAndPower ||
    hasSoundLimits ||
    hasTechnicalNotes;

  if (!hasAnyContent) return null;

  return {
    soundItems,
    backlineItems,
    stageSetup,
    houseRules,
    hasStageAndPower,
    hasSoundLimits,
    hasTechnicalNotes,
  };
}

/**
 * Gig details tech setup tile model: equipment grouped into Front of House / Stage / Backline,
 * plus the bottom physical-details block (stage + sound limits).
 * @returns {null | Object} null if no rider or nothing to show
 */
export function getGigDetailsTechSpecModel(techRider) {
  if (!techRider) return null;

  const { equipmentForDisplay, stageSetup, houseRules } = getTechRiderForDisplay(techRider);
  const fohItems = equipmentForDisplay.filter((item) => TECH_SPEC_GIG_DETAILS_FOH_KEYS.has(item.key));
  const stageItems = equipmentForDisplay.filter((item) => TECH_SPEC_GIG_DETAILS_STAGE_KEYS.has(item.key));
  const backlineItems = equipmentForDisplay.filter((item) => TECH_SPEC_GIG_DETAILS_BACKLINE_KEYS.has(item.key));

  const hasStageAndPower =
    (stageSetup?.stageSize && String(stageSetup.stageSize).trim()) ||
    (stageSetup?.powerOutlets != null && stageSetup.powerOutlets !== '');
  const hasSoundLimits =
    houseRules?.volumeLevel ||
    (houseRules?.noiseCurfew && String(houseRules.noiseCurfew).trim()) ||
    (houseRules?.volumeNotes && String(houseRules.volumeNotes).trim());
  const hasTechnicalNotes = stageSetup?.generalTechNotes && String(stageSetup.generalTechNotes).trim();

  const hasAnyContent =
    fohItems.length > 0 ||
    stageItems.length > 0 ||
    backlineItems.length > 0 ||
    hasStageAndPower ||
    hasSoundLimits ||
    hasTechnicalNotes;

  if (!hasAnyContent) return null;

  return {
    fohItems,
    stageItems,
    backlineItems,
    stageSetup,
    houseRules,
    hasStageAndPower,
    hasSoundLimits,
    hasTechnicalNotes,
  };
}
