import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { Box } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import SectionHeading from "../../components/SectionHeading";
import FileCard from "./FileCard";
import { downloadFile, type FileItem, type Permission } from "../../api/api";
import type { FilesView as View } from "./useFilesData";
import type { useFilesData } from "./useFilesData";
import type { useSelection } from "./useSelection";

type FileTarget = Parameters<typeof FileCard>[0]["file"];
type FilesData = ReturnType<typeof useFilesData>;
type SelectionApi = ReturnType<typeof useSelection>;

interface Props {
  showFolders: boolean;
  visibleFoldersCount: number;
  sortedFiles: FileItem[];
  view: View;
  readOnly: boolean;
  folderReadOnly: boolean;
  directionMap: FilesData["directionMap"];
  permissionMap: FilesData["permissionMap"];
  sharedByMap: FilesData["sharedByMap"];
  shareExpiryMap: FilesData["shareExpiryMap"];
  recipientCountMap: FilesData["recipientCountMap"];
  token: string;
  guard: FilesData["guard"];
  toggleFavorite: FilesData["toggleFavorite"];
  navigate: NavigateFunction;

  sharedFolderPermission?: Permission;
  handleSaveShared: (f: FileItem) => void;
  onLeaveShared: (f: FileItem) => void;
  onStopSharing: (f: FileItem) => void;
  onManageShareExpiry: (f: FileItem) => void;
  selectionEnabled: boolean;
  inSelectionMode: boolean;
  selection: SelectionApi;
  setMoveTarget: Dispatch<SetStateAction<FileTarget | null>>;
  setDeleteFileTarget: Dispatch<SetStateAction<FileTarget | null>>;
  setRenameFileTarget: Dispatch<SetStateAction<FileTarget | null>>;
  setShareFileTarget: Dispatch<SetStateAction<FileItem | null>>;
  setExpiryFileTarget: Dispatch<SetStateAction<FileItem | null>>;
}

export default function FilesGrid({
  showFolders, visibleFoldersCount, sortedFiles, view, readOnly, folderReadOnly,
  directionMap, permissionMap, sharedByMap, shareExpiryMap, recipientCountMap,
  token, guard, toggleFavorite, navigate, sharedFolderPermission,
  handleSaveShared, onLeaveShared, onStopSharing, onManageShareExpiry,
  selectionEnabled, inSelectionMode, selection,
  setMoveTarget, setDeleteFileTarget, setRenameFileTarget, setShareFileTarget, setExpiryFileTarget,
}: Props) {
  return (
    <Box>
      {showFolders && visibleFoldersCount > 0 && (
        <SectionHeading
          icon={
            <Icon name={Icons.file} sx={{ color: "text.secondary" }} />
          }
          label="Files"
          count={sortedFiles.length}
        />
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: 2,
        }}
      >
        {sortedFiles.map((f) => {

          const direction = view === "shared-recent" ? directionMap[f.id] : undefined;
          const incoming = view === "shared-with-me" || direction === "incoming";
          const outgoing = view === "shared-by-me" || direction === "outgoing";

          const inSharedFolder = folderReadOnly && view === "folder";
          const gated = incoming || inSharedFolder;
          const perm = incoming ? permissionMap[f.id] : inSharedFolder ? sharedFolderPermission : undefined;
          const canDownload = gated ? perm === "save" : true;
          const canSave = gated ? perm === "save" : false;

          const isExpiring = view === "expiring";
          return readOnly || folderReadOnly ? (
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
              onManageExpiry={
                outgoing ? () => onManageShareExpiry(f)
                  : isExpiring ? () => setExpiryFileTarget(f)
                  : undefined
              }
              onStopSharing={outgoing ? () => onStopSharing(f) : undefined}
              onMove={isExpiring ? () => setMoveTarget(f) : undefined}
              onRename={isExpiring ? () => setRenameFileTarget(f) : undefined}
              onDelete={isExpiring ? () => setDeleteFileTarget(f) : undefined}
              onRemove={incoming ? () => onLeaveShared(f) : undefined}
              selectable={selectionEnabled}
              selectionMode={inSelectionMode}
              selected={selection.isSelected("file", f.id)}
              onToggleSelect={() => selection.toggle("file", f.id)}
            />
          ) : (
            <FileCard
              key={f.id}
              file={f}
              onOpen={() => navigate(`/files/${f.id}`)}
              onToggleFavorite={() => toggleFavorite(f)}
              onMove={() => setMoveTarget(f)}
              onDownload={() => guard(() => downloadFile(token, f.id, f.original_name))}
              onDelete={() => setDeleteFileTarget(f)}
              onRename={() => setRenameFileTarget(f)}
              onShare={() => setShareFileTarget(f)}
              onManageExpiry={() => setExpiryFileTarget(f)}
              selectable={selectionEnabled}
              selectionMode={inSelectionMode}
              selected={selection.isSelected("file", f.id)}
              onToggleSelect={() => selection.toggle("file", f.id)}
            />
          );
        })}
      </Box>
    </Box>
  );
}
