/**
 * Tech Rider equipment config and migration.
 * Supports both legacy (soundSystem/backline) and new (equipment[]) data shapes.
 */

/** Default equipment list: key, label, and whether to show quantity input */
export const EQUIPMENT_DEFAULTS = [
  { key: 'pa', label: 'PA System', hasQuantity: false },
  { key: 'mixingConsole', label: 'Mixing Desk', hasQuantity: false },
  { key: 'soundEngineer', label: 'Sound Engineer', hasQuantity: false },
  { key: 'microphones', label: 'Microphones', hasQuantity: true },
  { key: 'micStands', label: 'Mic Stands', hasQuantity: true },
  { key: 'diBoxes', label: 'DI Boxes', hasQuantity: true },
  { key: 'stageMonitors', label: 'Stage Monitors', hasQuantity: true },
  { key: 'drumKit', label: 'Drum Kit', hasQuantity: false },
  { key: 'bassAmp', label: 'Bass Amp', hasQuantity: false },
  { key: 'guitarAmp', label: 'Guitar Amp', hasQuantity: false },
  { key: 'keyboard', label: 'Keyboard / Piano', hasQuantity: false },
  { key: 'keyboardStand', label: 'Keyboard Stand', hasQuantity: false },
  { key: 'stageLighting', label: 'Stage Lighting', hasQuantity: false },
  { key: 'djDecks', label: 'DJ Decks', hasQuantity: false },
];

/** Build one equipment item for the new structure */
function buildEquipmentItem(key, label, hasQuantity, overrides = {}) {
  return {
    key,
    label,
    available: overrides.available ?? false,
    pricing: overrides.pricing ?? 'free',
    hireFee: overrides.hireFee ?? null,
    quantity: hasQuantity ? (overrides.quantity ?? null) : null,
    notes: overrides.notes ?? null,
  };
}

/** Map legacy soundSystem/backline keys to new equipment keys (some merge) */
const LEGACY_TO_KEY = {
  pa: 'pa',
  mixingConsole: 'mixingConsole',
  vocalMics: 'microphones',
  diBoxes: 'diBoxes',
  drumKit: 'drumKit',
  bassAmp: 'bassAmp',
  guitarAmp: 'guitarAmp',
  keyboard: 'keyboard',
};

/** Legacy: available 'yes' -> true, 'no' or '' -> false. Count > 0 -> available true. */
function legacyAvailableToBool(available, count) {
  if (count !== undefined && count !== null && count !== '' && parseInt(count, 10) > 0) return true;
  return available === 'yes';
}

/** Get hire fee number from legacy (we didn't have hire in legacy, so null) */
function legacyHireFee(_legacy) {
  return null;
}

/**
 * Migrate legacy techRider (soundSystem + backline) into new shape.
 * Returns { equipment, stageSetup, houseRules } and leaves houseRules as-is.
 * Does not mutate input.
 */
export function migrateLegacyTechRiderToNew(techRider) {
  if (!techRider || !techRider.soundSystem && !techRider.backline) {
    return buildNewTechRiderShape();
  }

  const soundSystem = techRider.soundSystem || {};
  const backline = techRider.backline || {};
  const houseRules = { ...(techRider.houseRules || {}) };

  const equipmentMap = {};
  EQUIPMENT_DEFAULTS.forEach(({ key, label, hasQuantity }) => {
    equipmentMap[key] = buildEquipmentItem(key, label, hasQuantity);
  });

  // PA
  if (soundSystem.pa) {
    equipmentMap.pa = buildEquipmentItem('pa', 'PA System', false, {
      available: legacyAvailableToBool(soundSystem.pa.available),
      notes: soundSystem.pa.notes || null,
    });
  }
  // Mixing Console
  if (soundSystem.mixingConsole) {
    equipmentMap.mixingConsole = buildEquipmentItem('mixingConsole', 'Mixing Desk', false, {
      available: legacyAvailableToBool(soundSystem.mixingConsole.available),
      notes: soundSystem.mixingConsole.notes || null,
    });
  }
  // Vocal Mics -> Microphones
  if (soundSystem.vocalMics) {
    equipmentMap.microphones = buildEquipmentItem('microphones', 'Microphones', true, {
      available: legacyAvailableToBool(null, soundSystem.vocalMics.count),
      quantity: soundSystem.vocalMics.count != null && soundSystem.vocalMics.count !== '' ? parseInt(soundSystem.vocalMics.count, 10) : null,
      notes: soundSystem.vocalMics.notes || null,
    });
  }
  // DI Boxes
  if (soundSystem.diBoxes) {
    equipmentMap.diBoxes = buildEquipmentItem('diBoxes', 'DI Boxes', true, {
      available: legacyAvailableToBool(null, soundSystem.diBoxes.count),
      quantity: soundSystem.diBoxes.count != null && soundSystem.diBoxes.count !== '' ? parseInt(soundSystem.diBoxes.count, 10) : null,
      notes: soundSystem.diBoxes.notes || null,
    });
  }
  // Monitoring notes -> Stage Monitors notes (merge into stageMonitors)
  if (soundSystem.monitoring) {
    equipmentMap.stageMonitors = equipmentMap.stageMonitors || buildEquipmentItem('stageMonitors', 'Stage Monitors', true);
    equipmentMap.stageMonitors.notes = (equipmentMap.stageMonitors.notes ? equipmentMap.stageMonitors.notes + '\n' : '') + soundSystem.monitoring;
  }
  // Drum Kit, Bass Amp, Guitar Amp, Keyboard
  ['drumKit', 'bassAmp', 'guitarAmp', 'keyboard'].forEach((k) => {
    if (backline[k]) {
      equipmentMap[k] = buildEquipmentItem(k, EQUIPMENT_DEFAULTS.find(d => d.key === k)?.label || k, false, {
        available: legacyAvailableToBool(backline[k].available),
        notes: backline[k].notes || null,
      });
    }
  });

  const equipment = EQUIPMENT_DEFAULTS.map(({ key, label, hasQuantity }) => ({
    ...(equipmentMap[key] || buildEquipmentItem(key, label, hasQuantity)),
  }));

  const generalParts = [backline.other, techRider.stageSetup?.generalTechNotes].filter(Boolean);
  if (soundSystem.cables) generalParts.push(`Cables: ${soundSystem.cables}`);
  const generalTechNotes = generalParts.join('\n\n').trim() || '';

  const stageSetup = {
    stageSize: backline.stageSize || techRider.stageSetup?.stageSize || '',
    stageWidthM: techRider.stageSetup?.stageWidthM ?? null,
    stageDepthM: techRider.stageSetup?.stageDepthM ?? null,
    stageNotes: techRider.stageSetup?.stageNotes || '',
    powerOutlets: techRider.stageSetup?.powerOutlets ?? null,
    generalTechNotes,
  };

  return {
    equipment,
    stageSetup,
    houseRules,
  };
}

/** Build empty new tech rider shape */
export function buildNewTechRiderShape() {
  const equipment = EQUIPMENT_DEFAULTS.map(({ key, label, hasQuantity }) =>
    buildEquipmentItem(key, label, hasQuantity)
  );
  return {
    equipment,
    stageSetup: {
      stageSize: '',
      stageWidthM: null,
      stageDepthM: null,
      stageNotes: '',
      powerOutlets: null,
      generalTechNotes: '',
    },
    houseRules: {
      volumeLevel: '',
      volumeNotes: '',
      noiseCurfew: '',
      houseRules: '',
    },
  };
}

/**
 * Normalize raw techRider from Firestore to the new shape (for form state or display).
 * If it already has equipment[] we use it and merge stageSetup/houseRules; else we migrate from legacy.
 */
export function normalizeTechRider(techRider) {
  if (!techRider) return buildNewTechRiderShape();

  const hasNewShape = Array.isArray(techRider.equipment) && techRider.equipment.length > 0;
  if (hasNewShape) {
    const defaultsByKey = {};
    EQUIPMENT_DEFAULTS.forEach(({ key, label, hasQuantity }) => {
      defaultsByKey[key] = { key, label, hasQuantity };
    });
    const equipment = techRider.equipment.map((item) => {
      const def = defaultsByKey[item.key] || { key: item.key, label: item.label || item.key, hasQuantity: false };
      return {
        ...buildEquipmentItem(def.key, def.label, def.hasQuantity),
        ...item,
        label: item.label || def.label,
      };
    });
    // Ensure all default keys exist
    const byKey = {};
    equipment.forEach((e) => { byKey[e.key] = e; });
    EQUIPMENT_DEFAULTS.forEach(({ key, label, hasQuantity }) => {
      if (!byKey[key]) byKey[key] = buildEquipmentItem(key, label, hasQuantity);
    });
    return {
      equipment: EQUIPMENT_DEFAULTS.map((d) => byKey[d.key] || buildEquipmentItem(d.key, d.label, d.hasQuantity)),
      stageSetup: {
        stageSize: techRider.stageSetup?.stageSize ?? '',
        stageWidthM: techRider.stageSetup?.stageWidthM ?? null,
        stageDepthM: techRider.stageSetup?.stageDepthM ?? null,
        stageNotes: techRider.stageSetup?.stageNotes ?? '',
        powerOutlets: techRider.stageSetup?.powerOutlets ?? null,
        generalTechNotes: techRider.stageSetup?.generalTechNotes ?? '',
      },
      houseRules: {
        volumeLevel: techRider.houseRules?.volumeLevel ?? '',
        volumeNotes: techRider.houseRules?.volumeNotes ?? '',
        noiseCurfew: techRider.houseRules?.noiseCurfew ?? '',
        houseRules: techRider.houseRules?.houseRules ?? '',
      },
    };
  }

  return migrateLegacyTechRiderToNew(techRider);
}

/**
 * Convert normalized tech rider to the shape we save to Firestore (new structure only).
 * Saves equipment[], stageSetup, houseRules. Legacy soundSystem/backline are no longer written.
 */
export function techRiderToSavePayload(normalized) {
  if (!normalized) return { equipment: [], stageSetup: {}, houseRules: {} };
  return {
    equipment: normalized.equipment.map(({ key, label, available, pricing, hireFee, quantity, notes }) => ({
      key,
      label,
      available: !!available,
      pricing: pricing === 'hire' ? 'hire' : 'free',
      hireFee: pricing === 'hire' && hireFee != null ? Number(hireFee) : null,
      quantity: quantity != null && quantity !== '' ? parseInt(quantity, 10) : null,
      notes: notes && String(notes).trim() ? String(notes).trim() : null,
    })),
    stageSetup: {
      stageSize: normalized.stageSetup?.stageSize ?? '',
      stageWidthM: normalized.stageSetup?.stageWidthM ?? null,
      stageDepthM: normalized.stageSetup?.stageDepthM ?? null,
      stageNotes: normalized.stageSetup?.stageNotes ?? '',
      powerOutlets: normalized.stageSetup?.powerOutlets ?? null,
      generalTechNotes: normalized.stageSetup?.generalTechNotes ?? '',
    },
    houseRules: { ...normalized.houseRules },
  };
}

/**
 * Get a display-friendly shape from raw techRider (legacy or new).
 * Returns { equipmentForDisplay, stageSetup, houseRules } for use in VenuePage / GigPage.
 * equipmentForDisplay: array of { key, label, available, notes, count?, hireFee? } for items that are available or have notes.
 */
export function getTechRiderForDisplay(techRider) {
  if (!techRider) {
    return { equipmentForDisplay: [], stageSetup: {}, houseRules: {} };
  }
  const normalized = normalizeTechRider(techRider);
  const equipmentForDisplay = (normalized.equipment || [])
    .filter((item) => item.available || (item.notes && String(item.notes).trim()))
    .map((item) => ({
      key: item.key,
      label: item.label,
      available: item.available,
      notes: item.notes || null,
      count: item.quantity != null ? item.quantity : undefined,
      hireFee: item.pricing === 'hire' && item.hireFee != null ? item.hireFee : undefined,
    }));
  return {
    equipmentForDisplay,
    stageSetup: normalized.stageSetup || {},
    houseRules: normalized.houseRules || {},
  };
}
