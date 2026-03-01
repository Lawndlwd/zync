import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search, ChevronDown, X, Check } from 'lucide-react'

export interface ComboboxOption {
  value: string
  label: string
  iconUrl?: string
}

interface ComboboxBaseProps {
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  onSearch?: (query: string) => void
  isLoading?: boolean
  creatable?: boolean
}

interface SingleProps extends ComboboxBaseProps {
  multiple?: false
  value: string
  onChange: (value: string) => void
}

interface MultiProps extends ComboboxBaseProps {
  multiple: true
  value: string[]
  onChange: (value: string[]) => void
}

type ComboboxProps = SingleProps | MultiProps

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    className,
    disabled,
    onSearch,
    isLoading,
    creatable,
  } = props

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const isMulti = props.multiple === true

  const handleSearchChange = useCallback(
    (q: string) => {
      setSearch(q)
      if (onSearch) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = setTimeout(() => onSearch(q), 300)
      }
    },
    [onSearch]
  )

  // Filter options locally when no async search
  const filtered = onSearch
    ? options
    : options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current)
  }, [])

  const handleSelect = (optionValue: string) => {
    if (isMulti) {
      const current = props.value as string[]
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue]
      ;(props.onChange as (v: string[]) => void)(next)
    } else {
      ;(props.onChange as (v: string) => void)(optionValue)
      setOpen(false)
      setSearch('')
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMulti) {
      ;(props.onChange as (v: string[]) => void)([])
    } else {
      ;(props.onChange as (v: string) => void)('')
    }
  }

  // Display label
  const displayLabel = (() => {
    if (isMulti) {
      const selected = (props.value as string[])
        .map((v) => options.find((o) => o.value === v)?.label ?? (creatable ? v : undefined))
        .filter(Boolean)
      if (selected.length === 0) return placeholder
      if (selected.length <= 2) return selected.join(', ')
      return `${selected.length} selected`
    }
    const val = props.value as string
    if (!val) return placeholder
    return options.find((o) => o.value === val)?.label ?? val
  })()

  const hasValue = isMulti
    ? (props.value as string[]).length > 0
    : !!(props.value as string)

  // Selected icon for single mode
  const selectedIcon = !isMulti
    ? options.find((o) => o.value === (props.value as string))?.iconUrl
    : undefined

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-300 hover:border-zinc-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex items-center gap-2 truncate">
          {selectedIcon && (
            <img src={selectedIcon} alt="" className="h-4 w-4" />
          )}
          <span className={cn('truncate', !hasValue && 'text-zinc-500')}>
            {displayLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasValue && (
            <span
              role="button"
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-white/[0.1]"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn('transition-transform', open && 'rotate-180')}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg border border-white/[0.1] bg-[#1a1d1e]/95 backdrop-blur-md shadow-xl">
          <div className="p-2 border-b border-white/[0.08]">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {isLoading && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-500">
                Loading...
              </div>
            )}

            {!isLoading && filtered.length === 0 && !creatable && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-500">
                {search ? `No results for "${search}"` : 'No options'}
              </div>
            )}

            {creatable && search.trim() && !filtered.some((o) => o.value.toLowerCase() === search.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => handleSelect(search.trim())}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-indigo-400 hover:bg-white/[0.06]"
              >
                Create &ldquo;{search.trim()}&rdquo;
              </button>
            )}

            {filtered.map((option) => {
              const isSelected = isMulti
                ? (props.value as string[]).includes(option.value)
                : (props.value as string) === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'text-zinc-300 hover:bg-white/[0.06]'
                  )}
                >
                  {option.iconUrl && (
                    <img
                      src={option.iconUrl}
                      alt=""
                      className="h-4 w-4 shrink-0"
                    />
                  )}
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
