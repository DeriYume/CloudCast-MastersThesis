import type { ReactNode } from "react";
import { Card, Typography } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  children: ReactNode;
}

export default function SearchEmptyCard({ children }: Props) {
  return (
    <Card variant="outlined" sx={{ textAlign: "center", py: 8, px: 3, borderStyle: "dashed" }}>
      <Icon name={Icons.searchOff} size={44} sx={{ color: "text.disabled" }} />
      <Typography color="text.secondary" sx={{ mt: 1, mx: "auto", maxWidth: 420 }}>
        {children}
      </Typography>
    </Card>
  );
}
