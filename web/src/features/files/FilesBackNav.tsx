import type { NavigateFunction } from "react-router-dom";
import { Button, Breadcrumbs, Link, Typography } from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import type { FolderItem } from "../../api/api";
import type { FilesView as View } from "./useFilesData";
import { folderChain } from "../../utils/util";

interface Props {
  view: View;
  isSharedFolder: boolean;
  currentFolder?: FolderItem;
  folders: FolderItem[];
  navigate: NavigateFunction;
}

export default function FilesBackNav({ view, isSharedFolder, currentFolder, folders, navigate }: Props) {
  return (
    <>
      {(view === "shared-with-me" || view === "shared-by-me") && (
        <Button
          startIcon={<Icon name={Icons.arrowBack} />}
          onClick={() => navigate("/shared")}
          color="inherit"
          sx={{ mb: 1 }}
        >
          Shared
        </Button>
      )}

      {isSharedFolder && (
        <Button
          startIcon={<Icon name={Icons.arrowBack} />}
          onClick={() => navigate("/shared/with-me")}
          color="inherit"
          sx={{ mb: 1 }}
        >
          Shared with me
        </Button>
      )}

      {view === "folder" && currentFolder && !isSharedFolder && (
        <Breadcrumbs sx={{ mb: 1 }} aria-label="folder path">
          <Link
            component="button"
            type="button"
            underline="hover"
            color="inherit"
            onClick={() => navigate("/")}
          >
            All files
          </Link>
          {folderChain(folders, currentFolder.id).map((f, idx, arr) =>
            idx === arr.length - 1 ? (
              <Typography key={f.id} color="text.primary">
                {f.name}
              </Typography>
            ) : (
              <Link
                key={f.id}
                component="button"
                type="button"
                underline="hover"
                color="inherit"
                onClick={() => navigate(`/folders/${f.id}`)}
              >
                {f.name}
              </Link>
            )
          )}
        </Breadcrumbs>
      )}
    </>
  );
}
