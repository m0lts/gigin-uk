/**
 * Tech rider / equipment compatibility: compare venue provision vs artist requirements.
 * V1 model: venue provides? else artist can bring? else needs discussion.
 */

import { normalizeTechRider } from '../../features/venue/builder/techRiderConfig';

/** Equipment key to human label for compatibility summary */
const EQUIPMENT_LABELS = {
  pa: 'PA system',
  mixingConsole: 'Mixing desk',
  microphones: 'Vocal microphones',
  diBoxes: 'DI boxes',
  stageMonitors: 'Stage monitors',
  drumKit: 'Drum kit',
  bassAmp: 'Bass amp',
  guitarAmp: 'Guitar amp',
  powerSockets: 'Power sockets on stage',
};

/**
 * Resolve effective source when multiple performers have different choices: venue wins (strictest), else either, else own.
 */
function effectiveSource(values) {
  if (values.some((v) => v === 'venue')) return 'venue';
  if (values.some((v) => v === 'either')) return 'either';
  return 'own';
}

/**
 * Aggregate artist tech rider into band-level requirements and equipment sources.
 * @param {Object} artistTechRider - { lineup, performerDetails, paSource?, mixingDeskSource?, bringableGearNotes? }
 * @returns {{ needs: Object, sources: Object, bringableGearNotes: string }}
 */
export function aggregateArtistRequirements(artistTechRider) {
  const needs = {
    vocalMics: 0,
    diBoxes: 0,
    powerSockets: 0,
    stageMonitors: 0,
    bassAmp: false,
    guitarAmp: false,
    drumKit: false,
    pa: true,
    mixingDesk: true,
  };

  const lineup = artistTechRider?.lineup || [];
  const performerDetails = artistTechRider?.performerDetails || [];
  const guitarAmpSources = [];
  const bassAmpSources = [];
  const drumKitSources = [];

  lineup.forEach((performer, index) => {
    const details = performerDetails[index] || {};
    const instruments = performer.instruments || [];

    let performerNeedsVocalMic = false;
    instruments.forEach((inst) => {
      const d = details[inst];
      if (!d) return;

      if (d.needsMic === true || d.needsMicForSinging === true) {
        performerNeedsVocalMic = true;
      }
      if (d.needsDI === true) {
        needs.diBoxes += 1;
      }
      const sockets = d.needsPowerSockets;
      if (typeof sockets === 'number' && sockets > 0) {
        needs.powerSockets += sockets;
      } else if (sockets != null && sockets !== '') {
        const n = parseInt(sockets, 10);
        if (!Number.isNaN(n)) needs.powerSockets += n;
      }
      if (d.needsMonitor === true) {
        needs.stageMonitors += 1;
      }
      if (inst === 'Guitar') {
        const src = d.guitarAmpSource ?? (d.needsAmp === true ? 'venue' : 'either');
        if (src === 'venue' || src === 'own' || src === 'either') {
          needs.guitarAmp = true;
          guitarAmpSources.push(src);
        }
      }
      if (inst === 'Bass') {
        const src = d.bassAmpSource ?? (d.needsAmp === true ? 'venue' : 'either');
        if (src === 'venue' || src === 'own' || src === 'either') {
          needs.bassAmp = true;
          bassAmpSources.push(src);
        }
      }
      if (inst === 'Other') {
        const src = d.backlineSource ?? (d.needsAmp === true ? 'venue' : 'either');
        if (src === 'venue' || src === 'own' || src === 'either') {
          needs.guitarAmp = true;
          needs.bassAmp = true;
          guitarAmpSources.push(src);
          bassAmpSources.push(src);
        }
      }
      if (inst === 'Drums') {
        const src = d.drumKitSource ?? (d.needsDrumKit === true || d.needsCymbals === true ? 'venue' : 'either');
        if (src === 'venue' || src === 'own' || src === 'either') {
          needs.drumKit = true;
          drumKitSources.push(src);
        }
      }
    });
    if (performerNeedsVocalMic) needs.vocalMics += 1;
  });

  const sources = {
    pa: artistTechRider?.paSource ?? 'either',
    mixingDesk: artistTechRider?.mixingDeskSource ?? 'either',
    guitarAmp: needs.guitarAmp ? effectiveSource(guitarAmpSources) : null,
    bassAmp: needs.bassAmp ? effectiveSource(bassAmpSources) : null,
    drumKit: needs.drumKit ? effectiveSource(drumKitSources) : null,
  };

  return {
    needs,
    sources,
    bringableGearNotes: artistTechRider?.bringableGearNotes ?? '',
  };
}

/**
 * Get venue equipment summary from normalized tech rider (available + quantities + hireFee).
 * @param {Object} venueTechRider - raw venue techRider (legacy or new)
 * @returns {{ equipmentByKey: Object, powerOutlets: number }}
 */
export function getVenueEquipmentSummary(venueTechRider) {
  const normalized = normalizeTechRider(venueTechRider);
  const equipmentByKey = {};
  (normalized.equipment || []).forEach((item) => {
    const hasHireFee = item.pricing === 'hire' && item.hireFee != null && item.hireFee !== '';
    const hireFee = hasHireFee ? Number(item.hireFee) : null;
    equipmentByKey[item.key] = {
      available: !!item.available,
      quantity: item.quantity != null && item.quantity !== '' ? parseInt(item.quantity, 10) : (item.available ? 1 : 0),
      hireFee: Number.isNaN(hireFee) ? null : hireFee,
    };
  });
  const powerOutlets = normalized.stageSetup?.powerOutlets != null && normalized.stageSetup?.powerOutlets !== ''
    ? parseInt(normalized.stageSetup.powerOutlets, 10)
    : 0;
  return { equipmentByKey, powerOutlets: Number.isNaN(powerOutlets) ? 0 : powerOutlets };
}

/**
 * Compute compatibility: provided by venue (included), hireable (with fee), covered by artist, needs discussion.
 * @param {Object} artistTechRider
 * @param {Object} venueTechRider
 * @returns {{ providedByVenue: Array<{label: string}>, hireableEquipment: Array<{label: string, hireFee: number}>, coveredByArtist: Array<{label: string}>, needsDiscussion: Array<{label: string, note?: string}> }}
 */
export function computeCompatibility(artistTechRider, venueTechRider) {
  const providedByVenue = [];
  const hireableEquipment = [];
  const coveredByArtist = [];
  const needsDiscussion = [];

  const { needs, sources } = aggregateArtistRequirements(artistTechRider);
  const { equipmentByKey, powerOutlets } = getVenueEquipmentSummary(venueTechRider);

  const venueHas = (key, minQuantity = 1) => {
    const e = equipmentByKey[key];
    if (!e) return false;
    return e.available && (e.quantity >= minQuantity || (e.quantity === 0 && minQuantity === 1));
  };

  const venueQty = (key) => {
    const e = equipmentByKey[key];
    if (!e || !e.available) return 0;
    return e.quantity > 0 ? e.quantity : 1;
  };

  const venueHireFee = (key) => {
    const e = equipmentByKey[key];
    return e && e.hireFee != null && !Number.isNaN(e.hireFee) ? e.hireFee : null;
  };

  const pushVenueProvided = (venueKey, label) => {
    const fee = venueHireFee(venueKey);
    if (fee != null) {
      hireableEquipment.push({ key: venueKey, label, hireFee: fee });
    } else {
      providedByVenue.push({ label });
    }
  };

  const applySource = (source, venueKey, label) => {
    if (source === 'venue') {
      if (venueHas(venueKey)) pushVenueProvided(venueKey, label);
      else needsDiscussion.push({ label });
    } else if (source === 'own') {
      coveredByArtist.push({ label });
    } else {
      if (venueHas(venueKey)) pushVenueProvided(venueKey, label);
      else coveredByArtist.push({ label });
    }
  };

  // PA
  if (needs.pa) applySource(sources.pa, 'pa', EQUIPMENT_LABELS.pa);

  // Mixing desk
  if (needs.mixingDesk) applySource(sources.mixingDesk, 'mixingConsole', EQUIPMENT_LABELS.mixingConsole);

  // Vocal mics (technical requirement; quantity comparison)
  if (needs.vocalMics > 0) {
    const have = venueQty('microphones');
    if (have >= needs.vocalMics) {
      pushVenueProvided('microphones', `${EQUIPMENT_LABELS.microphones} (${needs.vocalMics})`);
    } else {
      needsDiscussion.push({
        label: EQUIPMENT_LABELS.microphones,
        note: `Act needs ${needs.vocalMics}; venue lists ${have}`,
      });
    }
  }

  // DI boxes (technical requirement; quantity comparison)
  if (needs.diBoxes > 0) {
    const have = venueQty('diBoxes');
    if (have >= needs.diBoxes) {
      pushVenueProvided('diBoxes', `${EQUIPMENT_LABELS.diBoxes} (${needs.diBoxes})`);
    } else {
      needsDiscussion.push({
        label: EQUIPMENT_LABELS.diBoxes,
        note: `Act needs ${needs.diBoxes}; venue lists ${have}`,
      });
    }
  }

  // Stage monitors (technical requirement)
  if (needs.stageMonitors > 0) {
    const have = venueQty('stageMonitors');
    if (have >= needs.stageMonitors) {
      pushVenueProvided('stageMonitors', `${EQUIPMENT_LABELS.stageMonitors} (${needs.stageMonitors})`);
    } else {
      needsDiscussion.push({
        label: EQUIPMENT_LABELS.stageMonitors,
        note: have > 0 ? `Act needs ${needs.stageMonitors}; venue lists ${have}` : `Act needs ${needs.stageMonitors}; venue lists 0`,
      });
    }
  }

  // Power sockets (technical requirement; no hire fee)
  if (needs.powerSockets > 0) {
    if (powerOutlets >= needs.powerSockets) {
      providedByVenue.push({ label: `${EQUIPMENT_LABELS.powerSockets} (${needs.powerSockets})` });
    } else {
      needsDiscussion.push({
        label: EQUIPMENT_LABELS.powerSockets,
        note: `Act needs ${needs.powerSockets}; venue lists ${powerOutlets}`,
      });
    }
  }

  // Drum kit
  if (needs.drumKit && sources.drumKit) applySource(sources.drumKit, 'drumKit', EQUIPMENT_LABELS.drumKit);

  // Bass amp
  if (needs.bassAmp && sources.bassAmp) applySource(sources.bassAmp, 'bassAmp', EQUIPMENT_LABELS.bassAmp);

  // Guitar amp
  if (needs.guitarAmp && sources.guitarAmp) applySource(sources.guitarAmp, 'guitarAmp', EQUIPMENT_LABELS.guitarAmp);

  return { providedByVenue, hireableEquipment, coveredByArtist, needsDiscussion };
}
