import { Stack, Typography } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  fileName?: string;
  onBack: () => void;
}

export default function FileDetailHeader({ fileName, onBack }: Props) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{ mb: 3, cursor: "pointer", width: "fit-content" }}
      onClick={onBack}
    >
      <Icon name={Icons.arrowBack} size={22} sx={{ color: "text.secondary" }} />
      <Typography sx={{ fontWeight: 500, fontSize: 13.5, color: "text.secondary" }}>All files</Typography>
      {fileName && (
        <>
          <Icon name={Icons.chevronRight} size={16} sx={{ color: "text.disabled" }} />
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 13.5, maxWidth: 360 }}>
            {fileName}
          </Typography>
        </>
      )}
    </Stack>
  );
}