import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography,
  Select, MenuItem, TextField, Box, FormControl,
} from "@mui/material";
import type { FolderItem } from "../../api/api";
import { Icon } from "../../components/icons";
import { fileGlyph } from "../../utils/util";

export type FilingDecision =
  | { kind: "existing"; folderId: string }
  | { kind: "new"; name: string }
  | { kind: "root" };

export interface FilingRow {
  index: number;
  fileName: string;
  mime: string;
  suggestedName: string;
  decision: FilingDecision;
}

interface Props {
  open: boolean;
  rows: FilingRow[];
  folders: FolderItem[];
  onApply: (decisions: Map<number, FilingDecision>) => void;
  onCancel: () => void;
}

const ROOT = "root";
const NEW = "new";

function decisionToValue(d: FilingDecision): string {
  if (d.kind === "existing") return `existing:${d.folderId}`;
  if (d.kind === "new") return NEW;
  return ROOT;
}

export default function FilingReviewDialog({ open, rows, folders, onApply, onCancel }: Props) {

  const [state, setState] = useState<Record<number, { decision: FilingDecision; newName: string }>>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<number, { decision: FilingDecision; newName: string }> = {};
    for (const r of rows) {
      init[r.index] = {
        decision: r.decision,
        newName: r.decision.kind === "new" ? r.decision.name : r.suggestedName,
      };
    }
    setState(init);
  }, [open, rows]);

  function setChoice(index: number, value: string, suggestedName: string) {
    setState((prev) => {
      const cur = prev[index] ?? { decision: { kind: "root" } as FilingDecision, newName: suggestedName };
      let decision: FilingDecision;
      if (value === ROOT) decision = { kind: "root" };
      else if (value === NEW) decision = { kind: "new", name: cur.newName || suggestedName };
      else decision = { kind: "existing", folderId: value.slice("existing:".length) };
      return { ...prev, [index]: { ...cur, decision } };
    });
  }
  function setNewName(index: number, name: string) {
    setState((prev) => {
      const cur = prev[index];
      if (!cur) return prev;
      return { ...prev, [index]: { newName: name, decision: cur.decision.kind === "new" ? { kind: "new", name } : cur.decision } };
    });
  }

  function apply() {
    const out = new Map<number, FilingDecision>();
    for (const r of rows) out.set(r.index, state[r.index]?.decision ?? { kind: "root" });
    onApply(out);
  }

  const topLevel = folders.filter((f) => !f.parent_id);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Where should these go?</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Smart filing suggested a home for each file. Confirm or change any of them - nothing moves
          until you apply.
        </Typography>
        <Stack spacing={1.25}>
          {rows.map((r) => {
            const cur = state[r.index];
            const value = cur ? decisionToValue(cur.decision) : ROOT;
            return (
              <Box key={r.index} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Icon name={fileGlyph(r.mime, r.fileName).icon} size={18} sx={{ color: "text.disabled", flexShrink: 0 }} />
                <Typography noWrap sx={{ flex: "1 1 32%", minWidth: 0, fontSize: 13.5 }} title={r.fileName}>
                  {r.fileName}
                </Typography>
                <FormControl size="small" sx={{ width: 150, flexShrink: 0 }}>
                  <Select
                    value={value}
                    onChange={(e) => setChoice(r.index, e.target.value, r.suggestedName)}
                  >
                    <MenuItem value={NEW}>New folder…</MenuItem>
                    <MenuItem value={ROOT}>Leave at root</MenuItem>
                    {topLevel.map((f) => (
                      <MenuItem key={f.id} value={`existing:${f.id}`}>{f.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ flex: "1 1 32%", minWidth: 0 }}>
                  {cur?.decision.kind === "new" && (
                    <TextField
                      value={cur.newName}
                      onChange={(e) => setNewName(r.index, e.target.value)}
                      placeholder="New folder name"
                      size="small"
                      fullWidth
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} color="inherit">Leave all at root</Button>
        <Button variant="contained" onClick={apply}>File them</Button>
      </DialogActions>
    </Dialog>
  );
}
