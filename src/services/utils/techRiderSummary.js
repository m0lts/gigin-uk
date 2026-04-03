/**
 * Tech rider summary display helpers.
 * Used by artist profile viewer and venue tech rider modal to show venue-focused summaries.
 */

/**
 * Format equipment source for artist profile tech rider display.
 * Uses requirement/capability wording (needs/bringing/can use), not gig-decided wording.
 */
export function formatEquipmentSourceLine(source, itemLabel) {
  if (source === 'venue') return `Needs venue ${itemLabel}`;
  if (source === 'own') return `Bringing own ${itemLabel}`;
  if (source === 'either') return `Can use venue ${itemLabel} or bring own`;
  return null;
}

/** Short display labels for positive requirements (venue-focused summary) */
export const REQUIREMENT_DISPLAY_LABELS = {
  needsMic: 'Needs mic provided',
  needsMicForSinging: 'Needs mic provided',
  needsDI: 'Needs DI box',
  needsKeyboardStand: 'Needs keyboard stand',
  hasSeat: 'Needs seat / stool',
  needsCymbals: 'Needs cymbals',
};

/**
 * Build summary lines for one performer: positive requirements only + equipment source lines.
 * @param {Object} details - performerDetails[index]
 * @param {string[]} instruments - performer.instruments
 * @param {Object} instrumentQuestions - INSTRUMENT_QUESTIONS map (instrument -> array of { key, type, label, options?, dependsOn? })
 * @returns {string[]} Array of strings to display
 */
export function getPerformerSummaryLines(details, instruments, instrumentQuestions) {
  const lines = [];
  const seen = new Set();

  const allQuestions = [];
  instruments.forEach((instrument) => {
    const questions = instrumentQuestions[instrument] || [];
    allQuestions.push(...questions.map((q) => ({ ...q, instrument })));
  });
  const dependencyOnlyKeys = new Set();
  allQuestions.forEach((question) => {
    if (!question.notes && question.type === 'yesno' && question.key !== 'extraNotes') {
      const isUsedAsDependency = allQuestions.some((q) => q.dependsOn && q.dependsOn.key === question.key);
      if (isUsedAsDependency) dependencyOnlyKeys.add(question.key);
    }
  });

  instruments.forEach((instrument) => {
    const instrumentDetails = details[instrument] || {};
    const questions = instrumentQuestions[instrument] || [];

    questions.forEach((question) => {
      if (dependencyOnlyKeys.has(question.key)) return;
      if (question.dependsOn) {
        if (instrumentDetails[question.dependsOn.key] !== question.dependsOn.value) return;
      }

      if (question.type === 'yesno') {
        if (question.key === 'bringingKeyboard' && instrumentDetails.bringingKeyboard === false) {
          const line = 'Needs keyboard provided';
          if (!seen.has(line)) {
            seen.add(line);
            lines.push(line);
          }
          return;
        }
        if (question.key === 'bringingInstrument' || question.key === 'bringingKeyboard') return;
        if (instrumentDetails[question.key] !== true) return;
        const label = REQUIREMENT_DISPLAY_LABELS[question.key] || question.label.replace(/\?/g, '').trim().replace(/^Need /i, 'Needs ');
        if (!seen.has(label)) {
          seen.add(label);
          lines.push(label);
        }
        return;
      }
      if (question.type === 'number') {
        const val = instrumentDetails[question.key];
        const num = typeof val === 'number' ? val : parseInt(val, 10);
        if (!Number.isNaN(num) && num > 0) {
          const line = num === 1 ? 'Needs 1 power socket' : `Needs ${num} power sockets`;
          if (!seen.has(line)) {
            seen.add(line);
            lines.push(line);
          }
        }
        return;
      }
    });

    if (instrument === 'Drums') {
      const src = instrumentDetails.drumKitSource ?? 'venue';
      const line = formatEquipmentSourceLine(src, 'drum kit');
      if (line && !seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
    if (instrument === 'Guitar') {
      const src = instrumentDetails.guitarAmpSource ?? 'venue';
      const line = formatEquipmentSourceLine(src, 'guitar amp');
      if (line && !seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
    if (instrument === 'Bass') {
      const src = instrumentDetails.bassAmpSource ?? 'venue';
      const line = formatEquipmentSourceLine(src, 'bass amp');
      if (line && !seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
  });

  // Performer notes (optional free text from the per-performer section)
  const performerNotes = details.performerNotes;
  if (performerNotes != null && typeof performerNotes === 'string' && performerNotes.trim() !== '') {
    lines.push(performerNotes.trim());
  }

  return lines;
}

/**
 * Effective source when multiple performers have different choices: venue (strictest) > either > own.
 */
function effectiveSource(values) {
  if (values.some((v) => v === 'venue')) return 'venue';
  if (values.some((v) => v === 'either')) return 'either';
  return 'own';
}

/**
 * Aggregate equipment requirements across all performers for the Equipment Summary block.
 * Only includes positive requirements (no zero or false).
 * @param {Object} techRider - { lineup, performerDetails, paSource?, mixingDeskSource? }
 * @returns {{ performerCount: number, items: Array<{ type: string, text: string }> }} items to display (countable + backline)
 */
export function getEquipmentSummary(techRider) {
  const lineup = techRider?.lineup || [];
  const performerDetails = techRider?.performerDetails || [];
  const items = [];
  let vocalMics = 0;
  let diBoxes = 0;
  let powerSockets = 0;
  const drumKitSources = [];
  const guitarAmpSources = [];
  const bassAmpSources = [];

  lineup.forEach((performer, index) => {
    const details = performerDetails[index] || {};
    const instruments = performer.instruments || [];
    let performerNeedsVocalMic = false;

    instruments.forEach((instrument) => {
      const d = details[instrument] || {};
      if (d.needsMic === true || (d.needsMicForSinging === true && d.singing === true)) performerNeedsVocalMic = true;
      if (d.needsDI === true) diBoxes += 1;
      const sockets = d.needsPowerSockets;
      const n = typeof sockets === 'number' ? sockets : parseInt(sockets, 10);
      if (!Number.isNaN(n) && n > 0) powerSockets += n;
      if (instrument === 'Drums' && (d.drumKitSource === 'venue' || d.drumKitSource === 'own' || d.drumKitSource === 'either')) {
        drumKitSources.push(d.drumKitSource);
      }
      if (instrument === 'Guitar' && (d.guitarAmpSource === 'venue' || d.guitarAmpSource === 'own' || d.guitarAmpSource === 'either')) {
        guitarAmpSources.push(d.guitarAmpSource);
      }
      if (instrument === 'Bass' && (d.bassAmpSource === 'venue' || d.bassAmpSource === 'own' || d.bassAmpSource === 'either')) {
        bassAmpSources.push(d.bassAmpSource);
      }
    });
    if (performerNeedsVocalMic) vocalMics += 1;
  });

  if (vocalMics > 0) items.push({ type: 'vocalMics', text: `Needs ${vocalMics} vocal mic${vocalMics === 1 ? '' : 's'}` });
  if (diBoxes > 0) items.push({ type: 'diBoxes', text: `Needs ${diBoxes} DI box${diBoxes === 1 ? '' : 'es'}` });
  if (powerSockets > 0) items.push({ type: 'powerSockets', text: `Needs ${powerSockets} power socket${powerSockets === 1 ? '' : 's'}` });

  if (techRider.paSource) {
    const pa = formatEquipmentSourceLine(techRider.paSource, 'PA');
    if (pa) items.push({ type: 'pa', text: pa });
  }
  if (techRider.mixingDeskSource) {
    const desk = formatEquipmentSourceLine(techRider.mixingDeskSource, 'mixer');
    if (desk) items.push({ type: 'mixingDesk', text: desk });
  }
  if (drumKitSources.length > 0) {
    const src = effectiveSource(drumKitSources);
    const line = formatEquipmentSourceLine(src, 'drum kit');
    if (line) items.push({ type: 'drumKit', text: line });
  }
  if (guitarAmpSources.length > 0) {
    const src = effectiveSource(guitarAmpSources);
    const label = guitarAmpSources.length > 1 ? 'guitar amps' : 'guitar amp';
    const line = formatEquipmentSourceLine(src, label);
    if (line) items.push({ type: 'guitarAmp', text: line });
  }
  if (bassAmpSources.length > 0) {
    const src = effectiveSource(bassAmpSources);
    const label = bassAmpSources.length > 1 ? 'bass amps' : 'bass amp';
    const line = formatEquipmentSourceLine(src, label);
    if (line) items.push({ type: 'bassAmp', text: line });
  }

  return { performerCount: lineup.length, items };
}
