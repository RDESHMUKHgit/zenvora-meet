import type { ThemeConfig } from 'antd';
import { tokens } from './tokens';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: tokens.colors.accentPrimary,
    colorInfo: tokens.colors.accentSecondary,
    colorSuccess: tokens.colors.success,
    colorWarning: tokens.colors.warning,
    colorError: tokens.colors.error,
    colorTextBase: tokens.colors.textPrimary,
    colorTextSecondary: tokens.colors.textSecondary,
    colorBgBase: tokens.colors.surfacePrimary,
    colorBgContainer: tokens.colors.surfacePrimary,
    colorBgLayout: tokens.colors.surfaceSecondary,
    colorBorder: tokens.colors.surfaceBorder,
    colorBorderSecondary: tokens.colors.surfaceBorderSubtle,
    borderRadius: 8,
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
  },
  components: {
    Button: {
      controlHeight: 40,
      borderRadius: 8,
      fontWeight: 500,
      primaryShadow: 'none',
      defaultBorderColor: tokens.colors.surfaceBorder,
      defaultColor: tokens.colors.textPrimary,
      defaultBg: tokens.colors.surfacePrimary,
      defaultHoverBg: tokens.colors.surfaceHover,
      defaultHoverBorderColor: tokens.colors.accentPrimary,
      defaultHoverColor: tokens.colors.accentPrimary,
    },
    Input: {
      controlHeight: 40,
      borderRadius: 8,
      colorBorder: tokens.colors.surfaceBorder,
      hoverBorderColor: tokens.colors.accentPrimary,
      activeBorderColor: tokens.colors.accentPrimary,
      paddingInline: 14,
    },
    Select: {
      controlHeight: 40,
      borderRadius: 8,
      colorBorder: tokens.colors.surfaceBorder,
    },
    Card: {
      borderRadiusLG: 10,
      colorBorderSecondary: tokens.colors.surfaceBorder,
      boxShadowTertiary: tokens.shadows.subtle,
      paddingLG: 20,
    },
    Modal: {
      borderRadiusLG: 10,
      headerBg: tokens.colors.surfacePrimary,
      contentBg: tokens.colors.surfacePrimary,
      titleFontSize: 18,
    },
    Tabs: {
      itemColor: tokens.colors.textMuted,
      itemSelectedColor: tokens.colors.accentPrimary,
      itemHoverColor: tokens.colors.textPrimary,
      inkBarColor: tokens.colors.accentPrimary,
      titleFontSize: 14,
    },
    Table: {
      borderRadius: 8,
      headerBg: tokens.colors.surfaceSecondary,
      headerColor: tokens.colors.textSecondary,
      rowHoverBg: tokens.colors.surfaceHover,
      borderColor: tokens.colors.surfaceBorderSubtle,
    },
    Switch: {
      colorPrimary: tokens.colors.accentPrimary,
      colorPrimaryHover: tokens.colors.accentPrimaryHover,
    },
    Dropdown: {
      borderRadiusLG: 8,
      boxShadowSecondary: tokens.shadows.elevated,
      colorBgElevated: tokens.colors.surfacePrimary,
    },
    Typography: {
      titleMarginBottom: 0,
    },
  },
};
