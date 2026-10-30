import React from 'react';
import { Button } from 'antd';
import { FileText, Download, Image as ImageIcon } from 'lucide-react';
import { tokens } from '../../styles/tokens';

export interface AttachmentItem {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  url?: string;
}

interface AttachmentPreviewProps {
  attachment: AttachmentItem;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment }) => {
  const isImage = attachment.mimeType.startsWith('image/');

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = () => {
    if (attachment.url) {
      window.open(attachment.url, '_blank');
    }
  };

  if (isImage && attachment.url) {
    return (
      <div
        style={{
          border: `1px solid ${tokens.colors.surfaceBorder}`,
          borderRadius: tokens.borderRadius.base,
          overflow: 'hidden',
          backgroundColor: tokens.colors.surfaceSecondary,
          maxWidth: '260px',
        }}
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '180px',
            }}
          >
            {attachment.name}
          </span>
          <Button
            size="small"
            type="text"
            icon={<Download size={13} />}
            onClick={handleDownload}
            aria-label="Download image"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: tokens.borderRadius.base,
        backgroundColor: tokens.colors.surfaceSecondary,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        maxWidth: '280px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: tokens.borderRadius.sm,
          backgroundColor: tokens.colors.surfacePrimary,
          border: `1px solid ${tokens.colors.surfaceBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isImage ? (
          <ImageIcon size={18} color={tokens.colors.accentPrimary} />
        ) : (
          <FileText size={18} color={tokens.colors.accentPrimary} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12.5px',
            fontWeight: 600,
            color: tokens.colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {attachment.name}
        </div>
        <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>
          {formatBytes(attachment.sizeBytes)}
        </div>
      </div>

      <Button
        size="small"
        type="text"
        icon={<Download size={14} color={tokens.colors.textSecondary} />}
        onClick={handleDownload}
        aria-label="Download attachment"
      />
    </div>
  );
};

