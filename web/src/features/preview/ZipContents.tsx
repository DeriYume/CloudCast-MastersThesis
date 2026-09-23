import { useEffect, useMemo, useState } from "react";
import {
  Box, List, ListItemButton, ListItem, ListItemIcon, ListItemText,
  Typography, CircularProgress, Alert, Breadcrumbs, Link,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import { getZipEntries, type ZipEntry } from "../../api/api";
import { useAuth } from "../auth/useAuth";
import { formatBytes } from "../../utils/util";

interface Props {
  fileId: string;
}

function childrenOf(entries: ZipEntry[], prefix: string) {
  const folders = new Set<string>();
  const files: { name: string; size: number }[] = [];
  for (const e of entries) {
    if (!e.path.startsWith(prefix)) continue;
    const rest = e.path.slice(prefix.length);
    if (rest === "") continue;
    const slash = rest.indexOf("/");
    if (slash === -1) files.push({ name: rest, size: e.size });
    else folders.add(rest.slice(0, slash));
  }
  return {
    folders: [...folders].sort((a, b) => a.localeCompare(b)),
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export default function ZipContents({ fileId }: Props) {
  const token = useAuth((s) => s.token)!;
  const [entries, setEntries] = useState<ZipEntry[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState("");

  useEffect(() => {
    let active = true;
    setEntries(null);
    setError(null);
    setPath("");
    getZipEntries(token, fileId)
      .then((res) => {
        if (!active) return;
        setEntries(res.entries);
        setTruncated(res.truncated);
      })
      .catch((e) => active && setError(e.message || "Could not read archive"));
    return () => {
      active = false;
    };
  }, [fileId, token]);

  const { folders, files } = useMemo(
    () => (entries ? childrenOf(entries, path) : { folders: [], files: [] }),
    [entries, path]
  );

  const segments = path ? path.replace(/\/$/, "").split("/") : [];

  if (error) {
    return (
      <Box sx={{ minHeight: 420, bgcolor: "background.paper", p: 2 }}>
        <Alert severity="warning">{error}</Alert>
      </Box>
    );
  }
  if (!entries) {
    return (
      <Box sx={{ minHeight: 420, bgcolor: "background.paper", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: 420,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}>
        <Breadcrumbs separator={<Icon name={Icons.chevronRight} />} sx={{ fontSize: 14 }}>
          <Link
            component="button"
            type="button"
            underline="hover"
            color={segments.length ? "inherit" : "text.primary"}
            onClick={() => setPath("")}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
          >
            <Icon name={Icons.home} /> Archive
          </Link>
          {segments.map((seg, i) => {
            const isLast = i === segments.length - 1;
            const target = segments.slice(0, i + 1).join("/") + "/";
            return isLast ? (
              <Typography key={target} color="text.primary" sx={{ fontSize: 14 }}>
                {seg}
              </Typography>
            ) : (
              <Link
                key={target}
                component="button"
                type="button"
                underline="hover"
                color="inherit"
                onClick={() => setPath(target)}
                sx={{ fontSize: 14 }}
              >
                {seg}
              </Link>
            );
          })}
        </Breadcrumbs>
      </Box>

      <List dense disablePadding sx={{ maxHeight: 320, overflow: "auto" }}>
        {folders.length === 0 && files.length === 0 && (
          <ListItem>
            <ListItemText
              primary="Empty folder"
              primaryTypographyProps={{ color: "text.secondary", fontSize: 13 }}
            />
          </ListItem>
        )}

        {folders.map((name) => (
          <ListItemButton key={`d/${name}`} onClick={() => setPath(`${path}${name}/`)}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon name={Icons.folder} sx={{ color: "primary.main" }} />
            </ListItemIcon>
            <ListItemText
              primary={name}
              primaryTypographyProps={{ sx: { fontSize: 13, wordBreak: "break-all" } }}
            />
            <Icon name={Icons.chevronRight} sx={{ color: "text.disabled" }} />
          </ListItemButton>
        ))}

        {files.map((f) => (
          <ListItem key={`f/${f.name}`}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon name={Icons.file} sx={{ color: "action.active" }} />
            </ListItemIcon>
            <ListItemText
              primary={f.name}
              primaryTypographyProps={{ sx: { fontSize: 13, wordBreak: "break-all" } }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2, whiteSpace: "nowrap" }}>
              {formatBytes(f.size)}
            </Typography>
          </ListItem>
        ))}
      </List>

      {truncated && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 2, py: 1, borderTop: 1, borderColor: "divider" }}
        >
          This archive has more than {entries.length} entries; the listing was capped.
        </Typography>
      )}
    </Box>
  );
}
