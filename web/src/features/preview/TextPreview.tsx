import { useEffect, useState } from "react";
import { Box, CircularProgress, Alert, Typography } from "@mui/material";
import { getFileText } from "../../api/api";
import { useAuth } from "../auth/useAuth";

interface Props {
  fileId: string;
}

export default function TextPreview({ fileId }: Props) {
  const token = useAuth((s) => s.token)!;
  const [text, setText] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setText(null);
    setError(null);
    getFileText(token, fileId)
      .then((r) => {
        if (!active) return;
        setText(r.text);
        setTruncated(r.truncated);
      })
      .catch((e) => active && setError(e.message || "Could not load file"));
    return () => {
      active = false;
    };
  }, [fileId, token]);

  if (error) {
    return (
      <Box sx={{ minHeight: 420, bgcolor: "background.paper", p: 2 }}>
        <Alert severity="warning">{error}</Alert>
      </Box>
    );
  }
  if (text === null) {
    return (
      <Box sx={{ minHeight: 420, bgcolor: "background.paper", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          minHeight: 420,
          maxHeight: 560,
          overflow: "auto",
          fontFamily: "monospace",
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          color: "text.primary",
        }}
      >
        {text || "(empty file)"}
      </Box>
      {truncated && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 2, py: 1, borderTop: 1, borderColor: "divider" }}
        >
          Preview truncated - download to see the full file.
        </Typography>
      )}
    </Box>
  );
}
