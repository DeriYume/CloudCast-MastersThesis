import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { OVERLAY_PRIMARY_HOVER } from "../../theme/colors.generated";
import { Box, Card, Typography } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import SectionHeading from "../../components/SectionHeading";
import FileCard from "../files/FileCard";
import FolderCard from "../folders/FolderCard";
import { downloadFile, type FileItem, type FolderItem } from "../../api/api";
import type { ExtraFolder, useFilesData } from "../files/useFilesData";
import { MONO_FONT } from "../../theme";

type FilesData = ReturnType<typeof useFilesData>;

interface Props {
  navigate: NavigateFunction;
  sortedFiles: FileItem[];

  sortedFolders: ExtraFolder[];
  directionMap: FilesData["directionMap"];
  permissionMap: FilesData["permissionMap"];
  sharedByMap: FilesData["sharedByMap"];
  shareExpiryMap: FilesData["shareExpiryMap"];
  recipientCountMap: FilesData["recipientCountMap"];
  handleSaveShared: (f: FileItem) => void;
  onLeaveShared: (f: FileItem) => void;
  onStopSharing: (f: FileItem) => void;
  onManageShareExpiry: (f: FileItem) => void;
  guard: FilesData["guard"];
  token: string;
  setShareFileTarget: Dispatch<SetStateAction<FileItem | null>>;

  onLeaveSharedFolder: (f: FolderItem) => void;
  onStopSharingFolder: (f: FolderItem) => void;
  onManageShareExpiryFolder: (f: FolderItem) => void;
  setShareFolderTarget: Dispatch<SetStateAction<FolderItem | null>>;
}

export default function SharedHub({
  navigate, sortedFiles, sortedFolders,
  directionMap, permissionMap, sharedByMap, shareExpiryMap, recipientCountMap,
  handleSaveShared, onLeaveShared, onStopSharing, onManageShareExpiry, guard, token,
  setShareFileTarget,
  onLeaveSharedFolder, onStopSharingFolder, onManageShareExpiryFolder, setShareFolderTarget,
}: Props) {
  const recentCount = sortedFolders.length + sortedFiles.length;
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          gap: 1.75,
        }}
      >
        {[
          {
            to: "/shared/by-me",
            icon: Icons.arrowUpward,
            title: "Shared by me",
            desc: "Your files and folders you've shared with others.",
          },
          {
            to: "/shared/with-me",
            icon: Icons.arrowDownward,
            title: "Shared with me",
            desc: "Files and folders others have shared with you.",
          },
        ].map((entry) => (
          <Card
            key={entry.to}
            variant="outlined"
            onClick={() => navigate(entry.to)}
            sx={{
              p: 2.25,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 1.75,
              transition: "border-color 0.12s, background-color 0.12s",
              "&:hover": { borderColor: "primary.main", bgcolor: OVERLAY_PRIMARY_HOVER },
            }}
          >
            <Box
              sx={(t) => ({
                width: 48, height: 48, flexShrink: 0, borderRadius: "8px",
                bgcolor: t.colors.primaryTint,
                display: "flex", alignItems: "center", justifyContent: "center",
              })}
            >
              <Icon name={entry.icon} size={26} sx={{ color: "primary.main" }} />
            </Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>
                {entry.title}
              </Typography>
              <Box sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 11.5, color: "text.disabled", mt: "2px" }}>
                {entry.desc}
              </Box>
            </Box>
            <Icon name={Icons.chevronRight} sx={{ color: "text.disabled" }} />
          </Card>
        ))}
      </Box>

      {recentCount > 0 && (
        <Box sx={{ mt: 4 }}>
          <SectionHeading
            icon={<Icon name={Icons.history} sx={{ color: "text.secondary" }} />}
            label="Recently shared"
            count={recentCount}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
              gap: 2,
            }}
          >
            {sortedFolders.map((f) => {
              const direction = directionMap[f.id];
              const incoming = direction === "incoming";
              const outgoing = direction === "outgoing";
              return (
                <FolderCard
                  key={f.id}
                  folder={f}
                  sharedBy={incoming ? sharedByMap[f.id] : undefined}
                  accessEndsAt={incoming ? shareExpiryMap[f.id] : undefined}
                  recipientCount={outgoing ? recipientCountMap[f.id] : undefined}
                  onOpen={() => navigate(`/folders/${f.id}`)}
                  onShare={outgoing ? () => setShareFolderTarget(f) : undefined}
                  onManageExpiry={outgoing ? () => onManageShareExpiryFolder(f) : undefined}
                  onStopSharing={outgoing ? () => onStopSharingFolder(f) : undefined}
                  onRemove={incoming ? () => onLeaveSharedFolder(f) : undefined}
                />
              );
            })}
            {sortedFiles.map((f) => {
              const direction = directionMap[f.id];
              const incoming = direction === "incoming";
              const outgoing = direction === "outgoing";
              const perm = incoming ? permissionMap[f.id] : undefined;
              const canDownload = incoming ? perm === "save" : true;
              const canSave = incoming && perm === "save";
              return (
                <FileCard
                  key={f.id}
                  file={f}
                  readOnly
                  sharedBy={incoming ? sharedByMap[f.id] : undefined}
                  accessEndsAt={incoming ? shareExpiryMap[f.id] : undefined}
                  recipientCount={outgoing ? recipientCountMap[f.id] : undefined}
                  onOpen={() => navigate(`/files/${f.id}`)}
                  onSave={canSave ? () => handleSaveShared(f) : undefined}
                  onDownload={
                    canDownload
                      ? () => guard(() => downloadFile(token, f.id, f.original_name))
                      : undefined
                  }
                  onShare={outgoing ? () => setShareFileTarget(f) : undefined}
                  onManageExpiry={outgoing ? () => onManageShareExpiry(f) : undefined}
                  onStopSharing={outgoing ? () => onStopSharing(f) : undefined}
                  onRemove={incoming ? () => onLeaveShared(f) : undefined}
                />
              );
            })}
          </Box>
        </Box>
      )}
    </>
  );
}
