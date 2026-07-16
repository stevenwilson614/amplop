/** Simple paw mark for the floating animal-of-the-day button. */
export default function AnimalFabIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <ellipse cx="14" cy="14" rx="5" ry="6.5" fill="white" opacity="0.95" />
      <ellipse cx="24" cy="10" rx="5" ry="6.5" fill="white" opacity="0.95" />
      <ellipse cx="34" cy="14" rx="5" ry="6.5" fill="white" opacity="0.95" />
      <ellipse cx="18" cy="22" rx="4" ry="5" fill="white" opacity="0.9" />
      <path
        d="M16 28c0-1 2-4 8-4s8 3 8 4c0 6-3.5 12-8 12s-8-6-8-12z"
        fill="white"
      />
    </svg>
  );
}
