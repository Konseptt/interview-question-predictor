type SiteLogoMarkProps = {
  className?: string;
  /** Square size in px. */
  size?: number;
};

export function SiteLogoMark({ className = "", size = 54 }: SiteLogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={`site-logo-mark ${className}`.trim()}
      aria-hidden
    >
      <circle className="logo-mark-ring" cx="32" cy="32" r="27.5" strokeWidth="2" />
      <line className="logo-mark-lines" x1="17" x2="45" y1="24" y2="24" strokeWidth="3" strokeLinecap="round" />
      <line className="logo-mark-lines" x1="19" x2="43" y1="34" y2="34" strokeWidth="3" strokeLinecap="round" />
      <line className="logo-mark-lines" x1="21" x2="39" y1="44" y2="44" strokeWidth="3" strokeLinecap="round" />
      <circle className="logo-mark-spark" cx="48.5" cy="18" r="4" strokeWidth="0" />
    </svg>
  );
}
