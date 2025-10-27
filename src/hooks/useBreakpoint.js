// src/hooks/useBreakpoint.js
import { BREAKPOINTS } from '@design/breakpoints';
import { useMediaQuery } from './useMediaQuery';

export function useBreakpoint() {
  const isSmUp = useMediaQuery(`(min-width:${BREAKPOINTS.sm}px)`);
  const isMdUp = useMediaQuery(`(min-width:${BREAKPOINTS.md}px)`);
  const isLgUp = useMediaQuery(`(min-width:${BREAKPOINTS.lg}px)`);
  const isXlUp = useMediaQuery(`(min-width:${BREAKPOINTS.xl}px)`);
  const is2xlUp = useMediaQuery(`(min-width:${BREAKPOINTS['2xl']}px)`);
  const current = is2xlUp ? '2xl'
                : isXlUp  ? 'xl'
                : isLgUp  ? 'lg'
                : isMdUp  ? 'md'
                : isSmUp  ? 'sm'
                : 'xs';
  return { current, isSmUp, isMdUp, isLgUp, isXlUp, is2xlUp };
}