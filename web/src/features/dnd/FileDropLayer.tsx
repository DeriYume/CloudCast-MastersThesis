import { Box, Stack, Typography } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import type { ShieldProps } from "./useDragAndDrop";
import type { FilesView as View } from "../files/useFilesData";

interface Props {
  shieldActive: boolean;
  shieldProps: ShieldProps;
  showOverlay: boolean;
  view: View;
  currentFolderName?: string;
}

export default function FileDropLayer({ shieldActive, shieldProps, showOverlay, view, currentFolderName }: Props) {
  return (
    <>

      {shieldActive && (
        <Box
          {...shieldProps}
          sx={{ position: "fixed", inset: 0, zIndex: 2000, bgcolor: "transparent" }}
        />
      )}
      {showOverlay && (
        <Box
          sx={(t) => ({
            position: "fixed",
            inset: 0,
            zIndex: 1300,
            bgcolor: t.colors.dropVeil,
            backdropFilter: "blur(3px)",
            border: "2px dashed",
            borderColor: "primary.main",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          })}
        >
          <Stack alignItems="center" spacing={1}>
            <Icon name={Icons.upload} size={52} sx={{ color: "primary.main", opacity: 0.9 }} />
            <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
              Drop to upload
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {view === "folder" ? `Into "${currentFolderName ?? "this folder"}"` : "Into All files"}
            </Typography>
          </Stack>
        </Box>
      )}
    </>
  );
}
