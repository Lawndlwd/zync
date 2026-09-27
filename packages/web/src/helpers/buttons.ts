export type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'destroy'

export type Size = 'sm' | 'md' | 'lg'

export const buttonClass = (variant: Variant, size: Size, extra = '') =>
  `btn btn-${variant}${size === 'md' ? '' : ` btn-${size}`}${extra ? ` ${extra}` : ''}`
