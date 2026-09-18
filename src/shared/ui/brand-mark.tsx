type BrandMarkProps = {
  className?: string
  size?: number
}

/**
 * La marque Themiros, reprise telle quelle de la landing page.
 * Le point vert #55A930 est le seul accent colore autorise par la charte.
 */
export function BrandMark({ className, size = 26 }: BrandMarkProps) {
  return (
    <svg
      aria-label="Themiros"
      className={className}
      fill="none"
      height={size}
      role="img"
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="#000000"
        height="32"
        rx="8"
        stroke="rgb(255 255 255 / 0.13)"
        width="32"
      />
      <path
        d="M8.5 10.5h12M14.5 10.5v11.5"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <circle cx="21.5" cy="21" fill="var(--brand-dot)" r="2.4" />
    </svg>
  )
}
