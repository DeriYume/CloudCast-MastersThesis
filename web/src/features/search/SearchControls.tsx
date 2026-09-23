import { Box, Stack, Button, Alert } from "@mui/material";
import { HOVER_ROW, WHITE } from "../../theme/colors.generated";
import { Icon, Icons } from "../../components/icons";
import { FILTERS, type FilterKey, type SearchMode } from "./searchTypes";

interface Props {
  mode: SearchMode;
  smart: boolean;
  filter: FilterKey;
  smartUnavailable: boolean;
  reindexing: boolean;
  setMode: (next: SearchMode) => void;
  setFilter: (key: FilterKey) => void;
  handleReindex: () => void;
}

export default function SearchControls({
  mode, smart, filter, smartUnavailable, reindexing, setMode, setFilter, handleReindex,
}: Props) {
  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 3, alignItems: { sm: "center" } }}
      >

        <Stack
          direction="row"
          spacing={0.5}
          sx={(t) => ({
            p: "3px",
            borderRadius: "8px",
            bgcolor: t.palette.mode === "light" ? HOVER_ROW : t.colors.page,
            border: "1px solid",
            borderColor: "divider",
            width: "fit-content",
          })}
        >
          {([
            { key: "name" as SearchMode, label: "Name", icon: Icons.search },
            { key: "smart" as SearchMode, label: "Smart", icon: Icons.autoAwesome },
          ]).map((m) => {
            const active = mode === m.key;
            return (
              <Box
                key={m.key}
                component="button"
                aria-label={m.key === "name" ? "search by name" : "smart search"}
                onClick={() => setMode(m.key)}
                sx={(t) => ({
                  display: "inline-flex", alignItems: "center", gap: 0.625, cursor: "pointer",
                  height: 32, px: 1.5, borderRadius: "6px", border: "none",
                  fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: 600, fontSize: 13,
                  bgcolor: active ? t.palette.primary.main : "transparent",
                  color: active ? WHITE : t.palette.text.secondary,
                })}
              >
                <Icon name={m.icon} size={17} fill={active && m.key === "smart"} />
                {m.label}
              </Box>
            );
          })}
        </Stack>

        {!smart && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Box
                  key={f.key}
                  component="button"
                  onClick={() => setFilter(f.key)}
                  sx={(t) => ({
                    cursor: "pointer", height: 30, px: 1.5, borderRadius: "7px",
                    fontFamily: '"Hanken Grotesk", sans-serif', fontWeight: active ? 600 : 500, fontSize: 12,
                    border: active ? "none" : "1px solid",
                    borderColor: "divider",
                    bgcolor: active ? t.palette.primary.main : "transparent",
                    color: active ? WHITE : t.palette.text.secondary,
                  })}
                >
                  {f.label}
                </Box>
              );
            })}
          </Stack>
        )}

        {smart && !smartUnavailable && (
          <Button
            size="small"
            variant="text"
            startIcon={<Icon name={Icons.refresh} />}
            onClick={handleReindex}
            disabled={reindexing}
            sx={{ ml: { sm: "auto" } }}
          >
            {reindexing ? "Starting…" : "Rebuild index"}
          </Button>
        )}
      </Stack>

      {smart && smartUnavailable && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Smart search isn't enabled on this server. Try{" "}
          <Box
            component="span"
            sx={{ textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
            onClick={() => setMode("name")}
          >
            Name search
          </Box>{" "}
          instead.
        </Alert>
      )}
    </>
  );
}
