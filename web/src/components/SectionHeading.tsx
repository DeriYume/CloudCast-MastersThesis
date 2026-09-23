import { Stack, Typography, Chip } from "@mui/material";

interface SectionHeadingProps {
  icon: React.ReactNode;
  label: string;
  count: number;
}

export default function SectionHeading({ icon, label, count }: SectionHeadingProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
      {icon}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
        {label}
      </Typography>
      <Chip
        label={count}
        size="small"
        sx={{ height: 20, fontSize: 11, bgcolor: "action.selected" }}
      />
    </Stack>
  );
}
