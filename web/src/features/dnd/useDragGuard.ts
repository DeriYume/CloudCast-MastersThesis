import { useEffect } from "react";

export function useDragGuard() {
  useEffect(() => {
    const carriesFiles = (e: DragEvent) => {
      const types = e.dataTransfer?.types;

      return !!types && Array.from(types).includes("Files");
    };
    const prevent = (e: DragEvent) => {
      if (carriesFiles(e)) e.preventDefault();
    };

    const events: (keyof WindowEventMap)[] = ["dragenter", "dragover", "drop"];
    for (const ev of events) {
      window.addEventListener(ev, prevent as EventListener, { capture: true });
    }
    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, prevent as EventListener, { capture: true });
      }
    };
  }, []);
}
