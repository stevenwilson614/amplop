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
  const { openTransaction, contextEnvelope } = useTransactionModal();

  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-6 z-[70] flex justify-center pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto flex w-[min(100%,340px)] items-end gap-0.5 rounded-full border border-black/5 bg-[rgba(235,238,242,0.94)] py-2 pl-1.5 pr-2 shadow-[0_8px_24px_rgba(16,18,23,0.14)] backdrop-blur-md">
        {tabs.map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-full px-0.5 py-2 text-[9px] font-mono font-semibold leading-none ${
              pathname === t.path ? "bg-white/80 text-brand-accent" : "text-brand-text-muted"
            }`}
          >
            <span className="text-sm leading-none">{t.icon}</span>
            <span className="mt-1 max-w-full truncate">{t.short}</span>
          </Link>
        ))}

        <button
          type="button"
          onClick={() => openTransaction(contextEnvelope ?? undefined)}
          aria-label="Add transaction"
          className="-mt-6 ml-0.5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-brand-accent text-2xl leading-none text-white shadow-[0_6px_16px_rgba(87,167,115,0.45)] ring-[3px] ring-[rgba(235,238,242,0.94)]"
        >
          +
        </button>
      </div>
    </nav>
  );
}
