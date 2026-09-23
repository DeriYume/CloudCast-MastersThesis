import { Box, Typography, Button, Stack, IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import type { FilesView as View } from "./useFilesData";
import type { useFileSort } from "./useFileSort";
import type { useFilesData } from "./useFilesData";
import type { useUploads } from "../uploads/useUploads";

type FileSort = ReturnType<typeof useFileSort>;
type FilesData = ReturnType<typeof useFilesData>;
type Uploads = ReturnType<typeof useUploads>;

interface Props {
  heading: string;
  filesCount: number;
  visibleFoldersCount: number;
  sortKey: FileSort["sortKey"];
  sortAsc: boolean;
  SORT_OPTIONS: FileSort["SORT_OPTIONS"];
  handleSortSelect: FileSort["handleSortSelect"];
  refresh: FilesData["refresh"];
  view: View;
  isVirtual: boolean;
  folderReadOnly: boolean;
  folderId?: string;
  openNewFolder: (parent: string | null) => void;
  isUploading: boolean;
  inputRef: Uploads["inputRef"];
  onUpload: Uploads["onUpload"];
}

export default function FilesToolbar({
  heading, filesCount, visibleFoldersCount, sortKey, sortAsc, SORT_OPTIONS, handleSortSelect,
  refresh, view, isVirtual, folderReadOnly, folderId, openNewFolder, isUploading, inputRef, onUpload,
}: Props) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ sm: "center" }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h4" component="h1">{heading}</Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh} aria-label="refresh">
              <Icon name={Icons.refresh} />
            </IconButton>
          </Tooltip>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {filesCount} file{filesCount === 1 ? "" : "s"}

          {visibleFoldersCount > 0
            ? ` · ${visibleFoldersCount} folder${visibleFoldersCount === 1 ? "" : "s"}`
            : ""}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="sort-label">Sort by</InputLabel>
          <Select
            labelId="sort-label"
            label="Sort by"
            value={sortKey}
            onChange={() => {}}
            renderValue={(val) => {
              const opt = SORT_OPTIONS.find((o) => o.key === val);
              return (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <span>{opt?.label}</span>
                  {sortAsc ? (
                    <Icon name={Icons.arrowUpward} size={16} />
                  ) : (
                    <Icon name={Icons.arrowDownward} size={16} />
                  )}
                </Stack>
              );
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <MenuItem key={o.key} value={o.key} onClick={() => handleSortSelect(o.key)}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ width: "100%" }}
                >
                  <span>{o.label}</span>
                  {o.key === sortKey &&
                    (sortAsc ? (
                      <Icon name={Icons.arrowUpward} size={16} sx={{ ml: 2 }} />
                    ) : (
                      <Icon name={Icons.arrowDownward} size={16} sx={{ ml: 2 }} />
                    ))}
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {view !== "favorites" && view !== "shared-hub" && !isVirtual && !folderReadOnly && (
          <Button
            variant="outlined"
            startIcon={<Icon name={Icons.createNewFolder} />}
            onClick={() => openNewFolder(view === "folder" && folderId ? folderId : null)}
          >
            New folder
          </Button>
        )}
        {view !== "favorites" && view !== "shared-hub" && !isVirtual && !folderReadOnly && (
          <Button
            variant="contained"
            component="label"
            startIcon={<Icon name={Icons.upload} />}
            disabled={isUploading}
          >
            Upload
            <input ref={inputRef} type="file" hidden multiple onChange={onUpload} />
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
