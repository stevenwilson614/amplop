"use client";

import { CURRENCY_DECIMALS } from "@/lib/currency";

interface Props {
  value: string;
  onChange: (v: string) => void;
  currency: string;
}

export default function Keypad({ value, onChange, currency }: Props) {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;

  function press(key: string) {
    if (key === "backspace") {
      onChange(value.slice(0, -1));
      return;
    }

    if (key === ".") {
      if (decimals === 0) return;          // IDR: no decimal
      if (value.includes(".")) return;     // already has one
      onChange((value || "0") + ".");
      return;
    }

    // Digit key
    if (value.includes(".")) {
      const afterDot = value.split(".")[1];
      if (afterDot.length >= decimals) return; // max decimal places reached
    }

    if (value === "0") {
      onChange(key);                       // replace leading zero
    } else {
      onChange(value + key);
    }
  }

  const rows = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    [decimals > 0 ? "." : "", "0", "backspace"],
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.flat().map((key, i) => {
        if (key === "") {
          return <div key={i} />;
        }
        if (key === "backspace") {
          return (
            <button
              key="backspace"
              onPointerDown={(e) => { e.preventDefault(); press("backspace"); }}
              className="flex items-center justify-center h-16 rounded-2xl bg-brand-surface text-brand-text-muted active:bg-brand-border transition-colors select-none"
            >
              <BackspaceIcon />
            </button>
          );
        }
        return (
          <button
            key={key}
            onPointerDown={(e) => { e.preventDefault(); press(key); }}
            className="flex items-center justify-center h-16 rounded-2xl bg-brand-surface text-brand-text text-2xl font-mono active:bg-brand-primary transition-colors select-none"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
    </svg>
  );
}
