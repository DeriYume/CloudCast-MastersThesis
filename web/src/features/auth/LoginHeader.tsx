import { Typography } from "@mui/material";

interface Props {
  qrMode: boolean;
  mode: "login" | "register";
}

export default function LoginHeader({ qrMode, mode }: Props) {
  return (
    <>
      <Typography variant="h4" component="h1" sx={{ fontSize: 26, mt: 3 }}>
        {qrMode ? "Sign in with another device" : mode === "login" ? "Sign in" : "Create your account"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
        {qrMode
          ? "Approve this device from one you're already signed in on."
          : mode === "login"
            ? "Use your CloudCast account."
            : "Set up your cloud."}
      </Typography>
    </>
  );
}
