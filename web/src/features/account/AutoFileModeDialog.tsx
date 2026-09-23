import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, RadioGroup, FormControlLabel, Radio, Typography, Box,
} from "@mui/material";

export type AutoFileMode = "off" | "type" | "smart";

export const AUTO_FILE_LABEL: Record<AutoFileMode, string> = {
  off: "Off",
  type: "By type",
  smart: "Smart",
};

const OPTIONS: { value: AutoFileMode; label: string; hint: string; needsAi?: boolean }[] = [
  { value: "off", label: "Off", hint: "New uploads stay where you put them." },
  { value: "type", label: "By type", hint: "Sort into Images, Videos, Documents… by file type." },
  {
    value: "smart",
    label: "Smart",
    hint: "AI reads the contents to pick a folder. Falls back to type when it can't tell.",
    needsAi: true,
  },
];

export default function AutoFileModeDialog({
  open, value, aiAvailable, onSelect, onClose,
}: {
  open: boolean;
  value: AutoFileMode;

  aiAvailable: boolean;
  onSelect: (mode: AutoFileMode) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Auto-file new uploads</DialogTitle>
      <DialogContent>
        <FormControl>
          <RadioGroup
            value={value}
            onChange={(e) => {
              onSelect(e.target.value as AutoFileMode);
              onClose();
            }}
          >
            {OPTIONS.map((o) => (
              <FormControlLabel
                key={o.value}
                value={o.value}
                disabled={o.needsAi && !aiAvailable}
                control={<Radio size="small" sx={{ alignSelf: "flex-start", pt: 0.75 }} />}
                sx={{ alignItems: "flex-start", mb: 1, mr: 0 }}
                label={
                  <Box sx={{ py: 0.5 }}>
                    <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{o.label}</Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                      {o.needsAi && !aiAvailable
                        ? "Unavailable - this server has AI switched off."
                        : o.hint}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
