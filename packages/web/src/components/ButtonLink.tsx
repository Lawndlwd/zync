import { Link, type LinkProps } from 'react-router'

import { buttonClass, type Size, type Variant } from '../helpers/buttons'

export function ButtonLink({
  variant = 'ghost',
  size = 'md',
  className = '',
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}
