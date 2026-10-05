import type { CSSProperties } from 'react';
import { C } from '../../styles/colors';

/** Match the highlighted AI panel in the brand profile. */
export const assistCardStyle: CSSProperties = {
  background: `linear-gradient(150deg,${C.legacyBgf6f2ff},${C.legacyBgfcf1fc})`,
  border: `1px solid ${C.promoBorder}`,
};
