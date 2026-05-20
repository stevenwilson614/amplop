interface Props {
  happy: boolean;
  className?: string;
}

/** Cute whale matching the Amplop app icon — smile or frown. */
export default function WhaleMood({ happy, className = "h-10 w-10" }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* body */}
      <ellipse cx="32" cy="36" rx="22" ry="14" fill="#fff" />
      {/* head bump */}
      <ellipse cx="38" cy="30" rx="14" ry="11" fill="#fff" />
      {/* tail */}
      <path
        d="M10 36 Q4 28 6 22 Q8 30 10 36 Q8 42 6 48 Q4 42 10 36"
        fill="#fff"
      />
      {/* belly stripes */}
      <path d="M22 40h16" stroke="#C8E6CC" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M24 44h12" stroke="#C8E6CC" strokeWidth="1.2" strokeLinecap="round" />
      {/* eye */}
      <circle cx="42" cy="28" r="2.2" fill="#1E2733" />
      <circle cx="42.8" cy="27.2" r="0.7" fill="#fff" />
      {/* mouth */}
      {happy ? (
        <path
          d="M36 34 Q42 38 48 34"
          stroke="#1E2733"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M36 37 Q42 33 48 37"
          stroke="#1E2733"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* happy spout / sad droop */}
      {happy ? (
        <>
          <path d="M34 18v5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="34" cy="15" rx="3" ry="2" fill="#8FD99A" />
          <circle cx="30" cy="20" r="1.5" fill="#57A773" opacity="0.7" />
          <circle cx="38" cy="21" r="1.2" fill="#57A773" opacity="0.7" />
        </>
      ) : (
        <path
          d="M34 22v3"
          stroke="#B0BEC5"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
