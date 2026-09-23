import { Box, Card, LinearProgress, Stack, Typography } from "@mui/material";
import { useTheme, type Theme } from "@mui/material/styles";
import { SUCCESS, WARNING, PRIMARY, SHADOW_INK } from "../../theme/colors.generated";
import { Icon, Icons } from "../../components/icons";
import { MONO_FONT } from "../../theme";
import { fileKind, KIND_SYMBOL } from "../../utils/util";

export interface UploadEntry {
  id: string;
  name: string;
  status: "pending" | "uploading" | "filing" | "done" | "error" | "skipped";
  error?: string;

  dest?: string;
}

function rowState(status: UploadEntry["status"], t: Theme) {
  const muted = t.colors.muted;
  const successText = t.palette.mode === "light" ? t.colors.accents.successText : t.colors.accents.successTextDark;
  switch (status) {
    case "done":
      return { label: "Done", labelColor: successText, icon: Icons.checkCircle, barColor: SUCCESS, value: 100, indeterminate: false };
    case "error":
      return { label: "Failed", labelColor: WARNING, icon: Icons.error, barColor: WARNING, value: 100, indeterminate: false };
    case "skipped":
      return { label: "Skipped", labelColor: muted, icon: Icons.removeCircle, barColor: muted, value: 0, indeterminate: false };
    case "filing":
      return { label: "Filing…", labelColor: PRIMARY, icon: Icons.autoAwesome, barColor: PRIMARY, value: 0, indeterminate: true };
    case "uploading":
      return { label: "Uploading…", labelColor: PRIMARY, icon: "", barColor: PRIMARY, value: 0, indeterminate: true };
    default:
      return { label: "Queued", labelColor: muted, icon: "", barColor: PRIMARY, value: 0, indeterminate: false };
  }
}

export default function UploadProgress({ entries }: { entries: UploadEntry[] }) {
  const theme = useTheme();
  if (entries.length === 0) return null;

  const done = entries.filter((e) => e.status === "done").length;
  const settled = entries.filter(
    (e) => e.status === "done" || e.status === "error" || e.status === "skipped"
  ).length;
  const total = entries.length;
  const allDone = settled === total;
  const filing = entries.some((e) => e.status === "filing");

  const heading = allDone
    ? `Uploaded ${total} file${total !== 1 ? "s" : ""}`
    : filing
    ? `Smart filing · ${done} / ${total}`
    : `Uploading · ${total} file${total !== 1 ? "s" : ""}`;

  return (
    <Card
      variant="outlined"
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 360,
        maxWidth: "92vw",
        zIndex: 1400,
        p: 0,
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: `0 24px 60px rgba(${SHADOW_INK.dark},.28)`,
      }}
    >

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.25, pt: 2, pb: 1 }}>
        <Box sx={{ fontFamily: MONO_FONT, fontWeight: 600, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "text.disabled" }}>
          {heading}
        </Box>
        <Box sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 11.5, color: "text.secondary" }}>
          {settled}/{total}
        </Box>
      </Stack>

      <Stack spacing={0} sx={{ px: 2.25, pb: 2, maxHeight: 260, overflowY: "auto" }}>
        {entries.map((e) => {
          const kind = fileKind("", e.name);
          const tile = KIND_SYMBOL[kind];
          const st = rowState(e.status, theme);
          return (
            <Stack key={e.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.25 }}>
              <Box
                sx={(t) => ({
                  width: 38, height: 38, flexShrink: 0, borderRadius: "7px",
                  bgcolor: t.colors.primaryTint,
                  display: "flex", alignItems: "center", justifyContent: "center",
                })}
              >
                <Icon name={tile.icon} size={20} color={tile.color} />
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                  <Stack sx={{ minWidth: 0, mr: 1 }}>
                    <Typography noWrap title={e.name} sx={{ fontWeight: 600, fontSize: 13 }}>
                      {e.name}
                    </Typography>
                    {e.dest && (
                      <Typography
                        noWrap
                        title={`Filed into ${e.dest}`}
                        sx={{ display: "flex", alignItems: "center", gap: 0.375, fontSize: 11, color: "text.secondary" }}
                      >
                        <Icon name={Icons.folder} size={12} />
                        {e.dest}
                      </Typography>
                    )}
                  </Stack>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0, fontFamily: MONO_FONT, fontWeight: 500, fontSize: 11, color: st.labelColor }}>
                    {st.icon && <Icon name={st.icon} size={13} fill={e.status === "done"} />}
                    {st.label}
                  </Box>
                </Stack>
                <LinearProgress
                  variant={st.indeterminate ? "indeterminate" : "determinate"}
                  value={st.value}
                  sx={(t) => ({
                    height: 6, borderRadius: 3,
                    bgcolor: t.colors.border,
                    "& .MuiLinearProgress-bar": { borderRadius: 3, backgroundColor: st.barColor },
                  })}
                />
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}
