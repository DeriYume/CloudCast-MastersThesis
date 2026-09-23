import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { Box, Stack } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import SectionHeading from "../../components/SectionHeading";
import FileCard from "../files/FileCard";
import FolderCard from "../folders/FolderCard";
import { useFolders } from "../folders/useFolders";
import { downloadFile, type FileItem, type FolderItem } from "../../api/api";

interface Props {
  showFolders: boolean;
  folders: FolderItem[];
  files: FileItem[];
  navigate: NavigateFunction;
  token: string;
  toggleFavorite: (f: FileItem) => void;
  setRenameTarget: Dispatch<SetStateAction<FileItem | null>>;
  setMoveTarget: Dispatch<SetStateAction<FileItem | null>>;
  setShareTarget: Dispatch<SetStateAction<FileItem | null>>;
  setExpiryTarget: Dispatch<SetStateAction<FileItem | null>>;
  setDeleteTarget: Dispatch<SetStateAction<FileItem | null>>;
}

export default function SearchResults({
  showFolders, folders, files, navigate, token, toggleFavorite,
  setRenameTarget, setMoveTarget, setShareTarget, setExpiryTarget, setDeleteTarget,
}: Props) {

  const allFolders = useFolders((s) => s.folders);
  const folderNameById = useMemo(
    () => new Map(allFolders.map((f) => [f.id, f.name])),
    [allFolders]
  );
  const locationOf = (f: FileItem) =>
    f.folder_id ? (folderNameById.get(f.folder_id) ?? "All files") : "All files";
  return (
    <Stack spacing={4}>
      {showFolders && (
        <Box>
          <SectionHeading
            icon={<Icon name={Icons.folder} sx={{ color: "text.secondary" }} />}
            label="Folders"
            count={folders.length}
          />
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
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onOpen={() => navigate(`/folders/${folder.id}`)}
              />
            ))}
          </Box>
        </Box>
      )}

      {files.length > 0 && (
        <Box>
          {showFolders && (
            <SectionHeading
              icon={<Icon name={Icons.file} sx={{ color: "text.secondary" }} />}
              label="Files"
              count={files.length}
            />
          )}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
              gap: 2,
            }}
          >
            {files.map((f) => (
              <FileCard
                key={f.id}
                file={f}
                location={locationOf(f)}
                readOnly
                onOpen={() => navigate(`/files/${f.id}`)}
                onDownload={() => downloadFile(token, f.id, f.original_name)}
                onToggleFavorite={() => toggleFavorite(f)}
                onRename={() => setRenameTarget(f)}
                onMove={() => setMoveTarget(f)}
                onShare={() => setShareTarget(f)}
                onManageExpiry={() => setExpiryTarget(f)}
                onDelete={() => setDeleteTarget(f)}
              />
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}
