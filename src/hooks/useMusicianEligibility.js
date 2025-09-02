import { useMemo } from 'react';
import { getMusicianEligibility } from '@services/utils/validation.js';

/**
 * @param {object|null} user - auth user object (may contain musicianProfile object)
 */
export function useMusicianEligibility(user) {
  const profile = user?.musicianProfile || null;
  const { canApply, reasons } = useMemo(() => getMusicianEligibility(profile), [profile]);
  return { loading: false, profile, canApply, reasons };
}