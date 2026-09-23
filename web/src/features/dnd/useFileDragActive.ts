import { useEffect, useState } from "react";

export function useFileDragActive(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {

    let depth = 0;

    const carriesFiles = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      return !!types && Array.from(types).includes("Files");
    };

    const onEnter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth += 1;
      setActive(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        setActive(false);
      }
    };

    const onOver = (e: DragEvent) => {
      if (carriesFiles(e)) setActive(true);
    };
    const end = () => {
      depth = 0;
      setActive(false);
    };

    window.addEventListener("dragenter", onEnter, { capture: true });
    window.addEventListener("dragleave", onLeave, { capture: true });
    window.addEventListener("dragover", onOver, { capture: true });
    window.addEventListener("drop", end, { capture: true });
    window.addEventListener("dragend", end, { capture: true });
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("dragenter", onEnter, { capture: true });
      window.removeEventListener("dragleave", onLeave, { capture: true });
      window.removeEventListener("dragover", onOver, { capture: true });
      window.removeEventListener("drop", end, { capture: true });
      window.removeEventListener("dragend", end, { capture: true });
      window.removeEventListener("blur", end);
    };
  }, []);

  return active;
}
