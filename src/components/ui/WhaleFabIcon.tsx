/** Standout whale icon for the floating buddy button — side-profile blue whale. */
export default function WhaleFabIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <ellipse cx="26" cy="26" rx="14" ry="9" fill="#fff" />
      <ellipse cx="30" cy="22" rx="9" ry="7" fill="#fff" />
      <path
        d="M8 26c-2-4-1-9 2-12 1 5 0 9-2 12zm-2 4c-3-2-4-6-2-9 2 3 3 6 2 9z"
        fill="#fff"
      />
      <path d="M18 28h12" stroke="#7eb8e8" strokeWidth="1" strokeLinecap="round" />
      <path d="M20 31h8" stroke="#7eb8e8" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="33" cy="21" r="1.5" fill="#1a3a5c" />
      <circle cx="33.5" cy="20.5" r="0.4" fill="#fff" />
      <path
        d="M28 25 Q32 28 36 25"
        stroke="#1a3a5c"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M28 14v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="28" cy="12" rx="2.5" ry="1.5" fill="#5eb3e8" />
      <circle cx="25" cy="15" r="1" fill="#3d9ad4" opacity="0.8" />
      <circle cx="31" cy="16" r="0.8" fill="#3d9ad4" opacity="0.8" />
    </svg>
  );
}
