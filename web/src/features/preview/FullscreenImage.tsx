import { useState, useRef, type WheelEvent, type MouseEvent } from "react";
import { SCRIM } from "../../theme/colors.generated";
import { Dialog, IconButton } from "@mui/material";
import { Icon, Icons } from "../../components/icons";

interface Props {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export default function FullscreenImage({ src, alt, open, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.002)));
  };

  const onMouseDown = (e: MouseEvent) => {
    if (scale <= 1) return;
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: SCRIM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
      }}
    >
      <IconButton
        onClick={handleClose}
        aria-label="Close preview"
        sx={{ position: "absolute", top: 12, right: 12, color: "common.white", zIndex: 1 }}
      >
        <Icon name={Icons.close} />
      </IconButton>

      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={reset}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "default",
          transition: drag.current ? "none" : "transform 0.1s ease-out",
          userSelect: "none",
        }}
        draggable={false}
      />
    </Dialog>
  );
}
