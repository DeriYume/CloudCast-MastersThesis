import { useRef } from "react";

export function useLongPress(onLongPress: () => void, delay = 450) {
  const timer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function cancel() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  const handlers = {
    onPointerDown(e: React.PointerEvent) {
      if (e.button !== 0) return;
      fired.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress();
      }, delay);
    },
    onPointerMove(e: React.PointerEvent) {
      if (timer.current === null || !startPos.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (dx * dx + dy * dy > 100) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
  };

  return { fired, cancel, handlers };
}
