import { useEffect, useRef, useState } from "react";

export function useDialogForm(open: boolean, reset?: () => void) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    resetRef.current?.();
  }, [open]);

  return { error, setError, busy, setBusy };
}
