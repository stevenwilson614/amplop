interface Props {
  happy: boolean;
  className?: string;
}

export default function WhaleMood({ happy, className = "h-10 w-10" }: Props) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <ellipse cx="24" cy="28" rx="16" ry="10" fill="#fff" />
      <path
        d="M36 24c4 2 6 6 6 10-2 0-4-1-5-3-1 2-3 3-5 3s-4-1-5-3c-1 2-3 3-5 3s-4-1-5-3c-1 2-3 3-5 3-2 0-4-1-5-3-1 2-3 3-5 3 0-4 2-8 6-10 4-2 8-2 12 0z"
        fill="#fff"
      />
      <circle cx="18" cy="26" r="1.6" fill="#1E2733" />
      {happy ? (
        <path d="M16 30c2 2 6 2 8 0" stroke="#1E2733" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M16 32c2-2 6-2 8 0" stroke="#1E2733" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}
      <path d="M10 28c-2 1-4 3-4 5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      {happy && (
        <>
          <path d="M22 16v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="22" cy="14" rx="2" ry="1.5" fill="#57A773" />
        </>
      )}
    </svg>
  );
}
