import { Link, useLocation } from "react-router-dom";

const tabs = [
  { path: "/envelopes", label: "Envelopes", icon: "◈" },
  { path: "/transactions", label: "Transactions", icon: "☰" },
  { path: "/insights", label: "Accounts", icon: "⌂" },
  { path: "/voice", label: "Reports", icon: "◔" },
  { path: "/settings", label: "More", icon: "•••" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="absolute inset-x-4 bottom-4 flex rounded-full border border-brand-border bg-brand-surface px-2 py-1 shadow-[0_12px_28px_rgba(16,18,23,0.12)]">
      {tabs.map((t) => (
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
    </nav>
  );
}
