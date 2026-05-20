import { ReactNode, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-brand-surface rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <h2 className="font-mono font-bold text-brand-text">{title}</h2>
          <button onClick={onClose} className="text-brand-text-muted font-mono text-sm">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
