/** Names in the step bar. The step ids underneath stay as they are. */
const STEP_LABELS = {
  Start: 'Start',
  'Date & time': 'Date & time',
  'Fee & tickets': 'Fee & tickets',
  Listing: 'The night',
  "Who's playing": 'Who plays',
  Review: 'Share',
};

export function wizardStepLabel(step) {
  return STEP_LABELS[step] || step;
}
