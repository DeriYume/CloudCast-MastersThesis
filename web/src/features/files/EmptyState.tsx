import { Box, Card, Typography } from "@mui/material";
import { OVERLAY_PRIMARY_DRAG } from "../../theme/colors.generated";
import { Icon, Icons } from "../../components/icons";
import type { FilesView as View } from "./useFilesData";

interface Props {
  view: View;
  isDraggingOverPage: boolean;
  currentFolderName?: string;
}

export default function EmptyState({ view, isDraggingOverPage, currentFolderName }: Props) {
  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        textAlign: "center",
        py: 8,
        px: 3,
        borderStyle: "dashed",
        borderColor: isDraggingOverPage ? "primary.main" : "divider",
        borderWidth: isDraggingOverPage ? 2 : 1,
        bgcolor: isDraggingOverPage ? OVERLAY_PRIMARY_DRAG : "transparent",
        transition: "all 0.15s",
      }}
    >

      <Box sx={{ opacity: isDraggingOverPage ? 0 : 1, transition: "opacity 0.15s" }}>
        {view === "favorites" ? (
        <>
          <Icon name={Icons.star} size={44} sx={{ color: "text.disabled" }} />
          <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: 420 }}>
            No favourites yet - tap{" "}
            <Icon name={Icons.star} size={16} sx={{ verticalAlign: "text-bottom" }} />{" "}
            on any file to add it here.
          </Typography>
        </>
      ) : view === "shared-with-me" ? (
        <>
          <Icon name={Icons.folderShared} size={44} sx={{ color: "text.disabled" }} />
          <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: 420 }}>
            Nothing shared with you yet - items others share will appear here.
          </Typography>
        </>
      ) : view === "shared-by-me" ? (
        <>
          <Icon name={Icons.callMade} size={44} sx={{ color: "text.disabled" }} />
          <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: 420 }}>
            You haven't shared anything yet - use Share on a file or folder.
          </Typography>
        </>
      ) : view === "shared-recent" ? (
        <>
          <Icon name={Icons.history} size={44} sx={{ color: "text.disabled" }} />
          <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: 420 }}>
            No sharing activity yet - files you share or receive will appear here.
          </Typography>
        </>
      ) : view === "expiring" ? (
        <>
          <Icon name={Icons.schedule} size={44} sx={{ color: "text.disabled" }} />
          <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: 420 }}>
            Nothing is set to expire - add an expiry to a file or folder to track it here.
          </Typography>
        </>
      ) : (
        <>
          <Icon name={Icons.upload} size={44} sx={{ color: "text.disabled" }} />
          <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: 420 }}>
            Nothing here yet - upload a file or drag files anywhere onto this page.
          </Typography>
        </>
      )}
      </Box>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",

          pointerEvents: "none",
          opacity: isDraggingOverPage ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        <Icon name={Icons.upload} size={44} sx={{ color: "primary.main", opacity: 0.85 }} />
        <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mt: 1 }}>
          Drop to upload
        </Typography>
        <Typography variant="body2" color="primary" sx={{ opacity: 0.65 }}>
          {view === "folder" ? `Into "${currentFolderName ?? "this folder"}"` : "Into All files"}
        </Typography>
      </Box>
    </Card>
  );
}
