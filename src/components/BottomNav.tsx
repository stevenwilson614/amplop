import { Link, useLocation } from "react-router-dom";
import { useTransactionModal } from "@/context/TransactionModalContext";

const tabs = [
  { path: "/envelopes", label: "Envelopes", icon: "◈" },
  { path: "/transactions", label: "Transactions", icon: "☰" },
  { path: "/settings", label: "More", icon: "•••" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { openTransaction } = useTransactionModal();

  return (
    <nav className="pointer-events-none absolute inset-x-3 bottom-6 z-[70] pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto relative flex items-end rounded-full border border-brand-border bg-brand-surface px-1 py-1 shadow-[0_12px_28px_rgba(16,18,23,0.12)]">
        {tabs.slice(0, 2).map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className={`flex flex-1 flex-col items-center justify-center rounded-full py-2 text-[11px] font-mono font-semibold ${
              pathname === t.path ? "bg-[#EBF8EF] text-brand-accent" : "text-brand-text-muted"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="mt-1 leading-none">{t.label}</span>
          </Link>
        ))}

        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openTransaction()}
            aria-label="Add transaction"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-3xl leading-none text-white shadow-[0_8px_20px_rgba(87,167,115,0.45)] ring-4 ring-brand-surface"
          >
            +
          </button>
        </div>

        {tabs.slice(2).map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className={`flex flex-1 flex-col items-center justify-center rounded-full py-2 text-[11px] font-mono font-semibold ${
              pathname === t.path ? "bg-[#EBF8EF] text-brand-accent" : "text-brand-text-muted"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="mt-1 leading-none">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
