import React from 'react';

/**
 * Subtle, unfilled, outlined decorative icons for the homepage background.
 * Completely sparse, low-contrast, non-interactive, and non-obstructive.
 */
export const BackgroundAesthetics: React.FC = () => {
  return (
    <div className="decorative-background" aria-hidden="true">
      {/* Top Left: Video Camera Outline */}
      <svg
        className="decorative-icon"
        style={{ top: '80px', left: '3%', width: '72px', height: '72px' }}
        viewBox="0 0 24 24"
      >
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" />
      </svg>

      {/* Top Right: Microphone Outline */}
      <svg
        className="decorative-icon"
        style={{ top: '110px', right: '4%', width: '60px', height: '60px' }}
        viewBox="0 0 24 24"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>

      {/* Mid Right Margin: Interaction Play Outline */}
      <svg
        className="decorative-icon"
        style={{ top: '48%', right: '2%', width: '52px', height: '52px' }}
        viewBox="0 0 24 24"
      >
        <polygon points="6 3 20 12 6 21 6 3" />
      </svg>

      {/* Bottom Left: Chat Bubble Outline */}
      <svg
        className="decorative-icon"
        style={{ bottom: '100px', left: '4%', width: '68px', height: '68px' }}
        viewBox="0 0 24 24"
      >
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>

      {/* Bottom Right: Monitor / Screen Outline */}
      <svg
        className="decorative-icon"
        style={{ bottom: '80px', right: '5%', width: '76px', height: '76px' }}
        viewBox="0 0 24 24"
      >
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    </div>
  );
};

