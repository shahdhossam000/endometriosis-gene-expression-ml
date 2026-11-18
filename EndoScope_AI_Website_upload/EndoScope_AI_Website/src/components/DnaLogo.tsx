export function DnaLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Subtle rounded dark-plum frame */}
      <rect
        x="1"
        y="1"
        width="26"
        height="26"
        rx="7"
        fill="#160D17"
        stroke="#311C33"
        strokeWidth="1.25"
      />
      {/* Base-pair rungs */}
      <line x1="9.5" y1="8.5" x2="18.5" y2="8.5" stroke="#FBCFE8" strokeWidth="1.35" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="11" y1="14" x2="17" y2="14" stroke="#F9A8D4" strokeWidth="1.35" strokeLinecap="round" strokeOpacity="0.9" />
      <line x1="9.5" y1="19.5" x2="18.5" y2="19.5" stroke="#FBCFE8" strokeWidth="1.35" strokeLinecap="round" strokeOpacity="0.85" />

      {/* Primary DNA helix strand */}
      <path
        d="M8.5 5.5C8.5 9.5 19.5 11.5 19.5 14C19.5 16.5 8.5 18.5 8.5 22.5"
        stroke="#F472B6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Complementary DNA helix strand */}
      <path
        d="M19.5 5.5C19.5 9.5 8.5 11.5 8.5 14C8.5 16.5 19.5 18.5 19.5 22.5"
        stroke="#EC4899"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Terminal nucleotide nodes */}
      <circle cx="8.5" cy="5.5" r="1.4" fill="#FBCFE8" />
      <circle cx="19.5" cy="5.5" r="1.4" fill="#F472B6" />
      <circle cx="8.5" cy="22.5" r="1.4" fill="#EC4899" />
      <circle cx="19.5" cy="22.5" r="1.4" fill="#FBCFE8" />
    </svg>
  );
}
