import { usePref } from './usePref'

/** Show dotfiles (.board.json, .opencode/…) in the file tree. Shared live by every tree on the page. */
export function useShowHidden(): [boolean, (v: boolean) => void] {
  const [on, setOn] = usePref<'0' | '1'>('zync:hidden-files', '0')
  return [on === '1', (v) => setOn(v ? '1' : '0')]
}
