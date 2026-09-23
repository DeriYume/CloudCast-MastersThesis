import { useState } from "react";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface AuthInputProps {
  kind: "email" | "password";
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  helperText?: string;
}

export default function AuthInput({
  kind, label, value, error, onChange,
  required, autoFocus, helperText = " ",
}: AuthInputProps) {
  const [show, setShow] = useState(false);
  const isPassword = kind === "password";
  const type = isPassword ? (show ? "text" : "password") : "email";

  return (
    <TextField
      label={label}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      autoFocus={autoFocus}
      error={error}
      helperText={helperText}
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            {isPassword ? (
              <Icon name={Icons.lock} sx={{ color: error ? "error.main" : "text.disabled" }} />
            ) : (
              <Icon name={Icons.mail} sx={{ color: error ? "error.main" : "text.disabled" }} />
            )}
          </InputAdornment>
        ),
        endAdornment: isPassword ? (
          <InputAdornment position="end">
            <IconButton
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow((s) => !s)}
              edge="end"
              size="small"
            >
              {show ? (
                <Icon name={Icons.visibilityOff} />
              ) : (
                <Icon name={Icons.visibility} />
              )}
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );
}
