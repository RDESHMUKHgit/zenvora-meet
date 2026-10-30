import React from 'react';
import { tokens } from '../../../styles/tokens';

interface NewMessageIndicatorProps {
  style?: React.CSSProperties;
}

/**
 * Subtle text-only unread indicator (design rule: "NEW" indicator, no numeric badges).
 */
export const NewMessageIndicator: React.FC<NewMessageIndicatorProps> = ({ style }) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1px 5px',
        fontSize: '9.5px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: tokens.colors.accentPrimary,
        backgroundColor: tokens.colors.accentPrimaryLight,
        border: `1px solid ${tokens.colors.accentPrimaryBorder}`,
        borderRadius: '10px',
        lineHeight: 1.2,
        userSelect: 'none',
        ...style,
      }}
    >
      NEW
    </span>
  );
};
