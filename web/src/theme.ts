import { createTheme, type Theme } from "@mui/material/styles";
import {
  type ThemeColors,
  COLORS,
  ACCENTS,
  SELECTION_TINT,
  SELECTION_BORDER,
  WHITE,
} from "./theme/colors.generated";

export const HEADING_FONT = '"Space Grotesk", system-ui, sans-serif';
export const BODY_FONT = '"Hanken Grotesk", system-ui, sans-serif';
export const MONO_FONT = '"JetBrains Mono", ui-monospace, monospace';

export type ThemeMode = "light" | "dark";

export type { ThemeColors };

declare module "@mui/material/styles" {
  interface Theme {
    colors: ThemeColors;
  }
  interface ThemeOptions {
    colors?: ThemeColors;
  }
}

export function buildTheme(mode: ThemeMode): Theme {
  const t = COLORS[mode];

  return createTheme({
    colors: {
      ...t,
      accents: ACCENTS,
      selectionTint: SELECTION_TINT,
      selectionBorder: SELECTION_BORDER,
    },
    palette: {
      mode,
      primary: { main: t.primary, dark: t.primaryHover, contrastText: WHITE },
      secondary: { main: mode === "light" ? ACCENTS.secondaryLight : ACCENTS.secondaryDark },
      success: { main: ACCENTS.success },
      warning: { main: ACCENTS.warning },
      background: { default: t.page, paper: t.surface },
      text: { primary: t.inkHeading, secondary: t.secondary, disabled: t.faint },
      divider: t.border,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: BODY_FONT,
      h1: { fontFamily: HEADING_FONT, fontWeight: 700, letterSpacing: "-0.02em" },
      h2: { fontFamily: HEADING_FONT, fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontFamily: HEADING_FONT, fontWeight: 700, letterSpacing: "-0.02em" },
      h4: { fontFamily: HEADING_FONT, fontWeight: 700, letterSpacing: "-0.02em" },
      h5: { fontFamily: HEADING_FONT, fontWeight: 600, letterSpacing: "-0.02em" },
      h6: { fontFamily: HEADING_FONT, fontWeight: 700, letterSpacing: "-0.02em" },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
      overline: {
        fontFamily: MONO_FONT,
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: t.muted,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: t.page },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600 },
          containedPrimary: {
            backgroundColor: t.primary,
            "&:hover": { backgroundColor: t.primaryHover },
          },
          outlined: {
            borderWidth: 1.5,
            borderColor: t.border,
            color: t.strong,
            "&:hover": { borderWidth: 1.5, borderColor: t.primary, backgroundColor: "transparent" },
          },
          sizeLarge: { height: 50 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          outlined: { borderColor: t.border },
        },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          root: {
            borderColor: t.border,
            borderRadius: 9,
            backgroundColor: t.surface,
            boxShadow: t.cardShadow,
            backgroundImage: "none",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: t.inputBg,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: t.border, borderWidth: 1.5 },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: t.muted },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: t.primary,
              borderWidth: 1.5,
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            fontFamily: BODY_FONT,

            "&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active":
              {
                WebkitBoxShadow: `0 0 0 100px ${t.inputBg} inset`,
                WebkitTextFillColor: t.inkHeading,
                caretColor: t.inkHeading,
                borderRadius: "inherit",
                transition: "background-color 9999s ease-in-out 0s",
              },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 7,
            fontWeight: 500,
            fontSize: 12,
            borderColor: t.border,
          },
          outlined: { borderColor: t.border },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: t.surface,
            borderColor: t.border,
            backgroundImage: "none",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: t.surface,
            color: t.inkHeading,
            borderBottom: `1px solid ${t.border}`,
            backgroundImage: "none",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 7,
            "&.Mui-selected": {
              backgroundColor: t.navActiveBg,
              "&:hover": { backgroundColor: t.navActiveBg },
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontFamily: BODY_FONT, fontSize: 12 },
        },
      },
    },
  });
}

export const theme = buildTheme("light");
export const lightTheme = theme;
export const darkTheme = buildTheme("dark");
