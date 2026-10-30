import React from 'react';
import { Popover, Button } from 'antd';
import { SmilePlus } from 'lucide-react';
import { ALLOWED_EMOJIS, type AllowedEmoji } from '../types/chat.types';
import { tokens } from '../../../styles/tokens';

interface ReactionPickerProps {
  onSelectEmoji: (emoji: AllowedEmoji) => void;
  trigger?: 'hover' | 'click';
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelectEmoji,
  trigger = 'click',
}) => {
  const [open, setOpen] = React.useState(false);

  const content = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px',
      }}
    >
      {ALLOWED_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelectEmoji(emoji);
            setOpen(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '4px 6px',
            borderRadius: tokens.borderRadius.sm,
            transition: 'transform 0.1s ease, background-color 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = tokens.colors.surfaceSecondary;
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      overlayInnerStyle={{
        padding: '4px 6px',
        backgroundColor: tokens.colors.surfacePrimary,
        borderRadius: '24px',
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        boxShadow: tokens.shadows.elevated,
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<SmilePlus size={13} color={tokens.colors.textMuted} />}
        style={{
          width: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          padding: 0,
        }}
        aria-label="Add reaction"
      />
    </Popover>
  );
};
