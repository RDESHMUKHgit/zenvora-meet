// Design Tokens for RD Video Meet
// Clean, light-themed premium communication application

export const tokens = {
  colors: {
    // Surfaces
    surfacePrimary: '#ffffff',
    surfaceSecondary: '#fafbfc',
    surfaceTertiary: '#f4f6f8',
    surfaceHover: '#f8fafc',
    surfaceBorder: '#e2e8f0',
    surfaceBorderSubtle: '#f1f5f9',

    // Background gradients (very delicate, light-themed tints)
    gradientBackground: 'linear-gradient(135deg, #f0fdf9 0%, #ffffff 50%, #f0f7ff 100%)',
    gradientSubtleCard: 'linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%)',

    // Typography
    textPrimary: '#0f172a', // Deep charcoal
    textSecondary: '#475569', // Slate gray
    textMuted: '#64748b', // Muted secondary text
    textLight: '#94a3b8',

    // Restrained Accents
    accentPrimary: '#0d9488', // Restrained Teal / Mint
    accentPrimaryHover: '#0f766e',
    accentPrimaryLight: '#f0fdfa',
    accentPrimaryBorder: '#ccfbf1',

    accentSecondary: '#2563eb', // Calm Royal Blue
    accentSecondaryHover: '#1d4ed8',
    accentSecondaryLight: '#eff6ff',
    accentSecondaryBorder: '#dbeafe',

    // Feedback States
    success: '#059669',
    successLight: '#ecfdf5',
    warning: '#d97706',
    warningLight: '#fffbeb',
    error: '#dc2626',
    errorLight: '#fef2f2',
    errorBorder: '#fecaca',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  borderRadius: {
    sm: '4px',
    base: '6px',
    md: '8px',
    lg: '10px',
  },
  shadows: {
    subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
    card: '0 2px 4px -1px rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
    elevated: '0 8px 16px -4px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
  },
  layout: {
    maxWidth: '1200px',
    headerHeight: '64px',
  },
} as const;

