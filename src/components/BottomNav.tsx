import { Link, useLocation } from "react-router-dom";
import { useTransactionModal } from "@/context/TransactionModalContext";

const tabs = [
  { path: "/envelopes", short: "Env", icon: "◈" },
  { path: "/transactions", short: "Tx", icon: "☰" },
  { path: "/insights", short: "AI", icon: "◎" },
  { path: "/settings", short: "More", icon: "•••" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { openTransaction } = useTransactionModal();

  return (
    <nav className="pointer-events-none absolute inset-x-5 bottom-6 z-[70] pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto flex items-end gap-0.5 rounded-full border border-brand-border bg-brand-surface py-1 pl-1 pr-1.5 shadow-[0_12px_28px_rgba(16,18,23,0.12)]">
        {tabs.map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-full px-0.5 py-1.5 text-[9px] font-mono font-semibold leading-none ${
              pathname === t.path ? "bg-[#EBF8EF] text-brand-accent" : "text-brand-text-muted"
            }`}
          >
            <span className="text-sm leading-none">{t.icon}</span>
            <span className="mt-0.5 max-w-full truncate">{t.short}</span>
          </Link>
        ))}

        <button
          type="button"
          onClick={() => openTransaction()}
          aria-label="Add transaction"
          className="-mt-5 ml-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-accent text-2xl leading-none text-white shadow-[0_6px_16px_rgba(87,167,115,0.45)] ring-[3px] ring-brand-surface"
        >
          +
        </button>
      </div>
    </nav>
  );
}
