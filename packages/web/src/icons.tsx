import type { CSSProperties, ReactNode } from 'react'

// Icons drawn exactly as in zync-design (16×16 viewBox). Each default size/stroke matches the
// place it is used most; pass `size`/`sw` where the design differs.

interface IconProps {
  size?: number
  sw?: number
  className?: string
  style?: CSSProperties
  stroke?: string
}

function stroked(children: ReactNode, defSize: number, defSw: number) {
  return ({ size = defSize, sw = defSw, className, style, stroke = 'currentColor' }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconMenu = stroked(<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />, 18, 1.4)
export const IconChevDown = stroked(<path d="M4 6l4 4 4-4" />, 12, 1.6)
export const IconChevRight = stroked(<path d="M6 4l4 4-4 4" />, 12, 1.6)
export const IconChevUp = stroked(<path d="M4 10l4-4 4 4" />, 13, 1.5)
export const IconSearch = stroked(
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </>,
  15,
  1.5,
)
export const IconBell = stroked(<path d="M4 11V7a4 4 0 018 0v4l1.2 1.5H2.8zM6.5 14h3" />, 17, 1.4)
export const IconGrid = stroked(
  <>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </>,
  16,
  1.4,
)
export const IconCalendar = stroked(
  <>
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
  </>,
  16,
  1.4,
)
export const IconFile = stroked(<path d="M4 1.8h5.2L12.5 5v9.2H4zM9 1.8v3.4h3.5" />, 16, 1.4)
export const IconBoard = stroked(
  <>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M6 2.5v11M10 2.5v11" />
  </>,
  16,
  1.4,
)
export const IconClock = stroked(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </>,
  16,
  1.4,
)
export const IconPeople = stroked(
  <>
    <circle cx="6" cy="6" r="2.5" />
    <path d="M1.8 13.5c.6-2.3 2.2-3.5 4.2-3.5s3.6 1.2 4.2 3.5" />
    <circle cx="11.5" cy="5.5" r="2" />
    <path d="M11 9.6c1.7 0 3 1 3.4 3" />
  </>,
  16,
  1.4,
)
export const IconSettings = stroked(
  <>
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
  </>,
  16,
  1.4,
)
export const IconMemory = stroked(
  <>
    <path d="M5.5 2.5a2.5 2.5 0 00-2.4 3.2A2.6 2.6 0 002.5 10a2.5 2.5 0 003 2.9A2 2 0 008 13.5V3.2A2 2 0 005.5 2.5z" />
    <path d="M10.5 2.5a2.5 2.5 0 012.4 3.2 2.6 2.6 0 01.6 4.3 2.5 2.5 0 01-3 2.9A2 2 0 018 13.5" />
  </>,
  16,
  1.4,
)
export const IconTrash = stroked(<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9M7 7v4.5M9 7v4.5" />, 14, 1.4)
export const IconPin = stroked(<path d="M6 2.5h4M7 2.5v4L4.5 9h7L9 6.5v-4M8 9v4.5" />, 12, 1.5)
export const IconPlus = stroked(<path d="M8 3v10M3 8h10" />, 14, 1.5)
export const IconFolder = stroked(
  <path d="M1.8 4.2c0-.6.4-1 1-1h3.4l1.4 1.6h5.6c.6 0 1 .4 1 1v6.4c0 .6-.4 1-1 1H2.8c-.6 0-1-.4-1-1z" />,
  15,
  1.3,
)
export const IconCheck = stroked(<path d="M3.5 8.3l3 3 6-6.3" />, 11, 2.2)
export const IconCross = stroked(<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />, 11, 2.2)
export const IconTimeout = stroked(
  <>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.2" />
  </>,
  11,
  1.8,
)
export const IconSkip = stroked(<path d="M4 4l5 4-5 4M11.5 4v8" />, 11, 1.8)
export const IconWarn = stroked(<path d="M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5v.5" />, 11, 1.8)
export const IconExpand = stroked(<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />, 14, 1.5)
export const IconPopout = stroked(
  <path d="M9 2.5h4.5V7M13.5 2.5L8 8M11.5 9.5v3.5c0 .3-.2.5-.5.5H3c-.3 0-.5-.2-.5-.5V5c0-.3.2-.5.5-.5h3.5" />,
  14,
  1.5,
)
export const IconCollapseDock = stroked(
  <>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M10 2.5v11M6 6.5l1.5 1.5L6 9.5" />
  </>,
  14,
  1.5,
)
export const IconSplit = stroked(
  <>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M9 2.5v11" />
  </>,
  14,
  1.4,
)

/** Dashed ring; spins unless the user prefers reduced motion (handled in CSS). */
export function IconSpin({ size = 12, sw = 2, className = 'spin', style }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      style={style}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" strokeDasharray="4 3" />
    </svg>
  )
}

export function IconSpark({ size = 14, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M8 1.2l1.5 5.3 5.3 1.5-5.3 1.5L8 14.8l-1.5-5.3L1.2 8l5.3-1.5z" />
    </svg>
  )
}
