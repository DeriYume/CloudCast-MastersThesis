import { Box, Button, Card, Typography } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  onBack: () => void;
}

export default function FolderMissing({ onBack }: Props) {
  return (
    <Box>
      <Button
        startIcon={<Icon name={Icons.arrowBack} />}
        onClick={onBack}
        color="inherit"
        sx={{ mb: 2 }}
      >
        All files
      </Button>
      <Card variant="outlined" sx={{ textAlign: "center", py: 8, px: 3 }}>
        <Icon name={Icons.folderOff} size={44} sx={{ color: "text.disabled" }} />
        <Typography variant="h6" sx={{ mt: 1 }}>
          Folder not found
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          This folder doesn't exist or isn't available on your account.
        </Typography>
      </Card>
    </Box>
  );
}
