import { useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}

const DELETE_WIDTH = 80;

export default function SwipeToDeleteRow({ children, onDelete, disabled = false }: Props) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const dragging = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startOffset.current = open ? -DELETE_WIDTH : 0;
    dragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current || disabled) return;
    const dx = e.touches[0].clientX - startX.current;
    const next = Math.max(-DELETE_WIDTH, Math.min(0, startOffset.current + dx));
    setOffset(next);
  }

  function onTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    const shouldOpen = offset < -DELETE_WIDTH / 2;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -DELETE_WIDTH : 0);
  }

  function close() {
    setOpen(false);
    setOffset(0);
  }

  function handleDelete() {
    onDelete();
    close();
  }

  return (
    <div className="relative overflow-hidden bg-brand-surface">
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: DELETE_WIDTH }}
      >
        <button
          type="button"
          onClick={handleDelete}
          className="flex w-full items-center justify-center bg-red-500 text-xs font-semibold text-white"
        >
          Delete
        </button>
      </div>
      <div
        className="relative bg-brand-surface transition-transform duration-150 ease-out touch-pan-y"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
