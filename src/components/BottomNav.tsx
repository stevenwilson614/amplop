import { Link, useLocation } from "react-router-dom";

const tabs = [
  { path: "/envelopes", label: "Envelopes" },
  { path: "/transactions", label: "Txns" },
  { path: "/insights", label: "Insights" },
  { path: "/voice", label: "Voice" },
  { path: "/settings", label: "Settings" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="flex border-t border-brand-border bg-brand-surface">
      {tabs.map((t) => (
        <Link
          key={t.path}
          to={t.path}
          className={`flex-1 py-3 text-center text-xs font-mono ${
            pathname === t.path ? "text-brand-accent" : "text-brand-text-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
