import { useState } from "react";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function PasswordField({
  label, value, onChange, autoComplete, error, helperText, fullWidth = true, onKeyDown,
}: Props) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      type={show ? "text" : "password"}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      autoComplete={autoComplete}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
      InputProps={{
        endAdornment: (
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
        ),
      }}
    />
  );
}
