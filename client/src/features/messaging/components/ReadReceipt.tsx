import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { tokens } from '../../../styles/tokens';

interface ReadReceiptProps {
  status?: 'sending' | 'sent' | 'failed';
  isReadByOthers?: boolean;
}

export const ReadReceipt: React.FC<ReadReceiptProps> = ({ status = 'sent', isReadByOthers = false }) => {
  if (status === 'sending') {
    return (
      <span title="Sending message..." style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Clock size={11} color={tokens.colors.textLight} />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span title="Failed to deliver message" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <AlertCircle size={11} color={tokens.colors.error} />
      </span>
    );
  }

  if (isReadByOthers) {
    return (
      <span title="Read" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <CheckCheck size={13} color={tokens.colors.accentPrimary} />
      </span>
    );
  }

  return (
    <span title="Delivered" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Check size={12} color={tokens.colors.textLight} />
    </span>
  );
};
