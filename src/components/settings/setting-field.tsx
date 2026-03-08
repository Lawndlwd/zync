import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function SettingField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  envValue,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  envValue?: string
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
        {label}
        {envValue && envValue !== '••••••••' && (
          <Badge variant="primary" className="text-[10px]">from vault</Badge>
        )}
        {envValue === '••••••••' && (
          <Badge variant="success" className="text-[10px]">configured</Badge>
        )}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={envValue && envValue !== '••••••••' ? envValue : placeholder}
      />
    </div>
  )
}
