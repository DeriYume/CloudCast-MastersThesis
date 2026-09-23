import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface Props {

  name: string;

  size?: number;

  fill?: boolean;
  color?: string;
  sx?: SxProps<Theme>;
}

export default function MaterialSymbol({ name, size = 20, fill = false, color, sx }: Props) {
  return (
    <Box
      component="span"
      aria-hidden
      className="material-symbols-rounded"

      style={{
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
      sx={{
        fontFamily: '"Material Symbols Rounded"',
        fontSize: size,
        lineHeight: 1,
        color,
        userSelect: "none",
        ...sx,
      }}
    >
      {name}
    </Box>
  );
}
