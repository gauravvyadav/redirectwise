interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 32, className = '' }: LogoProps) {
  // Canonical artwork lives in public/icons/logo.svg (shipped in the build;
  // website uses the matching website/assets/logo.svg). Rendered as an image
  // so the file stays the single source of truth — edit the file, update
  // everywhere. Works because popup/sidepanel/dashboard are extension pages.
  return (
    <img
      src="/icons/logo.svg"
      alt="RedirectWise logo"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}

// White version for use on colored backgrounds (stays inline: as an <img> it
// couldn't inherit currentColor, and it's a deliberate variant, not the logo)
export function LogoIcon({ size = 20, className = '' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <path
        d="M4 28L28 4M28 4H12M28 4V20"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
