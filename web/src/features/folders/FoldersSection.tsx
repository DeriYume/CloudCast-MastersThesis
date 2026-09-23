import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { Box } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import SectionHeading from "../../components/SectionHeading";
import FolderCard from "./FolderCard";
import type { FolderItem } from "../../api/api";
import type { FilesView as View } from "../files/useFilesData";
import type { useFilesData } from "../files/useFilesData";
import type { useSelection } from "../files/useSelection";
import type { FolderHandlers } from "../dnd/useDragAndDrop";

type FilesData = ReturnType<typeof useFilesData>;
type SelectionApi = ReturnType<typeof useSelection>;

interface Props {
  visibleFolders: FolderItem[];
  isVirtual: boolean;
  view: View;
  dragTarget: string | null;
  sharedByMap: FilesData["sharedByMap"];
  shareExpiryMap: FilesData["shareExpiryMap"];
  recipientCountMap: FilesData["recipientCountMap"];
  selectionEnabled: boolean;
  inSelectionMode: boolean;
  selection: SelectionApi;
  folderHandlers: FolderHandlers;
  navigate: NavigateFunction;
  openNewFolder: (parent: string | null) => void;
  confirmBulkMove: (dest: string | null) => void;
  setRenameFolderTarget: Dispatch<SetStateAction<FolderItem | null>>;
  setDeleteFolderTarget: Dispatch<SetStateAction<FolderItem | null>>;
  setFolderMoveTarget: Dispatch<SetStateAction<FolderItem | null>>;
  setShareFolderTarget: Dispatch<SetStateAction<FolderItem | null>>;
  setExpiryFolderTarget: Dispatch<SetStateAction<FolderItem | null>>;
  onLeaveShared: (f: FolderItem) => void;
  onStopSharing: (f: FolderItem) => void;
  onManageShareExpiry: (f: FolderItem) => void;

  showHeading?: boolean;
}

export default function FoldersSection({
  visibleFolders, isVirtual, view, dragTarget,
  sharedByMap, shareExpiryMap, recipientCountMap,
  selectionEnabled, inSelectionMode, selection, folderHandlers,
  navigate, openNewFolder, confirmBulkMove,
  setRenameFolderTarget, setDeleteFolderTarget, setFolderMoveTarget,
  setShareFolderTarget, setExpiryFolderTarget, onLeaveShared, onStopSharing, onManageShareExpiry,
  showHeading = true,
}: Props) {
  const outgoing = view === "shared-by-me";
  const isExpiring = view === "expiring";
  const incoming = view === "shared-with-me";
  return (
    <Box>
      {showHeading && (
        <SectionHeading
          icon={<Icon name={Icons.folder} sx={{ color: "text.secondary" }} />}
          label="Folders"
          count={visibleFolders.length}
        />
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: 1.5,
        }}
      >
        {visibleFolders.map((folder) =>
          isVirtual ? (
            <FolderCard
              key={folder.id}
              folder={folder}
              sharedBy={view === "shared-with-me" ? sharedByMap[folder.id] : undefined}
              accessEndsAt={view === "shared-with-me" ? shareExpiryMap[folder.id] : undefined}
              recipientCount={view === "shared-by-me" ? recipientCountMap[folder.id] : undefined}
              onOpen={() => navigate(`/folders/${folder.id}`)}
              onShare={outgoing ? () => setShareFolderTarget(folder) : undefined}
              onManageExpiry={
                outgoing ? () => onManageShareExpiry(folder)
                  : isExpiring ? () => setExpiryFolderTarget(folder)
                  : undefined
              }
              onStopSharing={outgoing ? () => onStopSharing(folder) : undefined}
              onMoveFolder={isExpiring ? () => setFolderMoveTarget(folder) : undefined}
              onRename={isExpiring ? () => setRenameFolderTarget(folder) : undefined}
              onDelete={isExpiring ? () => setDeleteFolderTarget(folder) : undefined}
              onRemove={incoming ? () => onLeaveShared(folder) : undefined}
              selectable={selectionEnabled}
              selectionMode={inSelectionMode}
              selected={selection.isSelected("folder", folder.id)}
              onToggleSelect={() => selection.toggle("folder", folder.id)}
            />
          ) : (
            <FolderCard
              key={folder.id}
              folder={folder}
              isDragTarget={dragTarget === folder.id}
              onOpen={() => navigate(`/folders/${folder.id}`)}
              onRename={() => setRenameFolderTarget(folder)}
              onDelete={() => setDeleteFolderTarget(folder)}
              onNewSubfolder={() => openNewFolder(folder.id)}
              onMoveFolder={() => setFolderMoveTarget(folder)}
              onShare={() => setShareFolderTarget(folder)}
              onManageExpiry={() => setExpiryFolderTarget(folder)}
              selectable={selectionEnabled}
              selectionMode={inSelectionMode}
              selected={selection.isSelected("folder", folder.id)}
              onToggleSelect={() => selection.toggle("folder", folder.id)}
              draggable
              onDragEnter={() => folderHandlers.onDragEnter(folder.id)}
              onDragLeave={() => folderHandlers.onDragLeave(folder.id)}
              onMoveFile={(fileId) => folderHandlers.onMoveFile(fileId, folder.id)}
              onMoveFolderInto={(draggedId) => folderHandlers.onMoveFolder(draggedId, folder.id)}
              onMoveSelectionInto={(destId) => confirmBulkMove(destId)}
              onDrop={(e) => folderHandlers.onDrop(e, folder.id)}
            />
          )
        )}
      </Box>
    </Box>
  );
}
