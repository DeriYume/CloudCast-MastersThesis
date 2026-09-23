import { Box, Stack, Typography, useTheme } from "@mui/material";
import { LOGO, LOGO_PATH, LOGO_MARK } from "../theme/colors.generated";

interface Props {

  size?: number;

  wordmark?: number | false;
}

export default function Logo({ size = 34, wordmark = 18 }: Props) {
  const theme = useTheme();
  const fill = theme.palette.mode === "dark" ? LOGO_MARK.dark : LOGO_MARK.light;
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        component="svg"
        viewBox={`0 0 ${LOGO.unit} ${LOGO.unit}`}
        role="img"
        aria-label="CloudCast"
        sx={{ width: size, height: size, flexShrink: 0, display: "block" }}
      >
        <path d={LOGO_PATH} fill={fill} fillRule="nonzero" />
      </Box>
      {wordmark !== false && (
        <Typography
          component="span"
          sx={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: 700,
            fontSize: wordmark,
            letterSpacing: "-0.02em",
            color: "text.primary",
            lineHeight: 1,
          }}
        >
          Cloud<Box component="span" sx={{ color: "primary.main" }}>Cast</Box>
        </Typography>
      )}
    </Stack>
  );
}
