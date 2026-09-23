import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, FormControlLabel, Checkbox,
} from "@mui/material";
import { Icon, Icons } from "../../components/icons";
import type { ConflictInfo, ConflictChoice } from "../../api/api";

interface Props {
  conflict: ConflictInfo | null;

  allowApplyAll?: boolean;
  onResolve: (choice: ConflictChoice) => void;
}

export default function ConflictDialog({ conflict, allowApplyAll = false, onResolve }: Props) {
  const [applyAll, setApplyAll] = useState(false);

  useEffect(() => { if (conflict) setApplyAll(false); }, [conflict]);

  const kind = conflict?.type ?? "item";
  const pick = (action: ConflictChoice["action"]) => onResolve({ action, all: applyAll });

  return (
    <Dialog open={Boolean(conflict)} onClose={() => pick("skip")} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon name={Icons.warning} sx={{ color: "warning.main" }} /> Name already exists
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          A {kind} named{" "}
          <Typography component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
            {conflict?.name}
          </Typography>{" "}
          already exists here. What would you like to do?
        </Typography>
        {conflict?.type === "folder" && (
          <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 1.5 }}>
            Replacing a folder deletes the existing folder and everything inside it.
          </Typography>
        )}
        {allowApplyAll && (
          <FormControlLabel
            sx={{ mt: 1, display: "block" }}
            control={<Checkbox checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />}
            label="Apply to all remaining conflicts"
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
        <Button onClick={() => pick("skip")} color="inherit">Skip</Button>
        <Button onClick={() => pick("rename")} variant="outlined">Keep both</Button>
        <Button onClick={() => pick("replace")} variant="contained" color="error">Replace</Button>
      </DialogActions>
    </Dialog>
  );
}
