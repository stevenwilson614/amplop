import { Link, useLocation } from "react-router-dom";
import { useTransactionModal } from "@/context/TransactionModalContext";

const tabs = [
  { path: "/envelopes", label: "Daily", Icon: EnvelopeIcon },
  { path: "/save-for", label: "Save", Icon: PiggyIcon },
  { path: "/cash", label: "Cash", Icon: CashIcon },
  { path: "/transactions", label: "Txns", Icon: ListIcon },
  { path: "/settings", label: "More", Icon: GridIcon },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { openTransaction, contextEnvelope } = useTransactionModal();

  return (
    <nav
      aria-label="Main navigation"
      className="relative z-[70] shrink-0 border-t border-black/5 bg-[rgba(235,238,242,0.98)] px-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-[320px] items-end gap-0 rounded-full border border-black/5 bg-[rgba(235,238,242,0.94)] py-1.5 pl-0.5 pr-1 shadow-[0_8px_24px_rgba(16,18,23,0.14)]">
        {tabs.map((t) => {
          const active = pathname === t.path;
          return (
            <Link
              key={t.path}
              to={t.path}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-full px-0 py-1 ${
                active ? "bg-white/80 text-brand-accent" : "text-brand-text-muted"
              }`}
            >
              <t.Icon active={active} />
              <span className="mt-0.5 max-w-full truncate font-mono text-[8px] font-semibold leading-none">
                {t.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => openTransaction(contextEnvelope ?? undefined)}
          aria-label="Add transaction"
          className="-mt-5 ml-0.5 flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-brand-accent text-xl leading-none text-white shadow-[0_6px_16px_rgba(87,167,115,0.45)] ring-[3px] ring-[rgba(235,238,242,0.94)]"
        >
          +
        </button>
      </div>
    </nav>
  );
}

function EnvelopeIcon({ active }: { active: boolean }) {
  const stroke = active ? "#57A773" : "#8A939E";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8l8-4 8 4v8l-8 4-8-4V8z"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 12v8M4 8l8 4 8-4" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function PiggyIcon({ active }: { active: boolean }) {
  const stroke = active ? "#57A773" : "#8A939E";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="13" rx="7" ry="5" stroke={stroke} strokeWidth="1.8" />
      <circle cx="16" cy="11" r="1" fill={stroke} />
      <path d="M6 13H4M19 12l2-1" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CashIcon({ active }: { active: boolean }) {
  const stroke = active ? "#57A773" : "#8A939E";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke={stroke} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke={stroke} strokeWidth="1.8" />
    </svg>
  );
}

function ListIcon({ active }: { active: boolean }) {
  const stroke = active ? "#57A773" : "#8A939E";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill={stroke} />
      <circle cx="4" cy="12" r="1.2" fill={stroke} />
      <circle cx="4" cy="18" r="1.2" fill={stroke} />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  const fill = active ? "#57A773" : "#8A939E";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" fill={fill} />
      <rect x="13" y="4" width="7" height="7" rx="1.5" fill={fill} />
      <rect x="4" y="13" width="7" height="7" rx="1.5" fill={fill} />
      <rect x="13" y="13" width="7" height="7" rx="1.5" fill={fill} />
    </svg>
  );
}
