import { Link, useLocation } from "react-router-dom";
import { useTransactionModal } from "@/context/TransactionModalContext";

const tabs = [
  { path: "/envelopes", label: "Envelope", Icon: EnvelopeIcon },
  { path: "/transactions", label: "Txns", Icon: ListIcon },
  { path: "/insights", label: "Insights", Icon: SparkIcon },
  { path: "/settings", label: "More", Icon: GridIcon },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { openTransaction, contextEnvelope } = useTransactionModal();

  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-6 z-[70] flex justify-center px-3 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto flex w-full max-w-[320px] items-end gap-0 rounded-full border border-black/5 bg-[rgba(235,238,242,0.94)] py-1.5 pl-0.5 pr-1 shadow-[0_8px_24px_rgba(16,18,23,0.14)] backdrop-blur-md">
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

function SparkIcon({ active }: { active: boolean }) {
  const stroke = active ? "#57A773" : "#8A939E";
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3z"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
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
