import type { CvTheme } from '@/types/jobs'
import { CV_THEMES, FONT_OPTIONS } from '@/lib/cv-themes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Columns2, Columns3, PanelLeft, AlignCenter, AlignLeft, AlignJustify } from 'lucide-react'

interface ThemeCustomizerProps {
  theme: CvTheme
  onChange: (theme: CvTheme) => void
}

const LAYOUT_OPTIONS: { value: CvTheme['layout']; label: string; icon: React.ReactNode }[] = [
  { value: 'single-column', label: 'Single', icon: <Columns2 className="size-4" /> },
  { value: 'two-column', label: 'Two Col', icon: <Columns3 className="size-4" /> },
  { value: 'sidebar', label: 'Sidebar', icon: <PanelLeft className="size-4" /> },
]

const HEADER_OPTIONS: { value: CvTheme['headerStyle']; label: string; icon: React.ReactNode }[] = [
  { value: 'centered', label: 'Centered', icon: <AlignCenter className="size-4" /> },
  { value: 'left', label: 'Left', icon: <AlignLeft className="size-4" /> },
  { value: 'inline', label: 'Inline', icon: <AlignJustify className="size-4" /> },
]

export function ThemeCustomizer({ theme, onChange }: ThemeCustomizerProps) {
  const set = <K extends keyof CvTheme>(key: K, value: CvTheme[K]) => {
    onChange({ ...theme, [key]: value })
  }

  return (
    <div className="space-y-6">
      {/* Preset selector */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">Preset Themes</Label>
        <div className="grid grid-cols-3 gap-2">
          {CV_THEMES.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onChange(preset)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                theme.id === preset.id
                  ? 'ring-2 ring-indigo-500 border-indigo-500/50 bg-white/[0.06]'
                  : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex gap-1 shrink-0">
                <span
                  className="block size-2.5 rounded-full"
                  style={{ backgroundColor: preset.primaryColor }}
                />
                <span
                  className="block size-2.5 rounded-full"
                  style={{ backgroundColor: preset.accentColor }}
                />
              </div>
              <span className="text-zinc-100 truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color controls */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">Colors</Label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['primaryColor', 'Primary'],
              ['secondaryColor', 'Secondary'],
              ['accentColor', 'Accent'],
              ['backgroundColor', 'Background'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={theme[key]}
                onChange={(e) => set(key, e.target.value)}
                className="w-8 h-8 rounded-md border border-white/[0.08] bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded"
              />
              <span className="text-zinc-400 text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Font selectors */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">Fonts</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="text-zinc-500 text-xs">Heading</span>
            <Select value={theme.fontHeading} onValueChange={(v) => set('fontHeading', v)}>
              <SelectTrigger className="w-full bg-white/[0.03] border-white/[0.08] text-zinc-100" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-zinc-500 text-xs">Body</span>
            <Select value={theme.fontBody} onValueChange={(v) => set('fontBody', v)}>
              <SelectTrigger className="w-full bg-white/[0.03] border-white/[0.08] text-zinc-100" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Layout selector */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">Layout</Label>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set('layout', opt.value)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all ${
                theme.layout === opt.value
                  ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-400'
                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header style */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">Header Style</Label>
        <div className="grid grid-cols-3 gap-2">
          {HEADER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set('headerStyle', opt.value)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all ${
                theme.headerStyle === opt.value
                  ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-400'
                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">Typography</Label>

        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Font Size</span>
              <span className="text-zinc-500 text-xs tabular-nums">{theme.fontSize}pt</span>
            </div>
            <Slider
              value={[theme.fontSize]}
              onValueChange={([v]) => set('fontSize', v)}
              min={8}
              max={14}
              step={0.5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Line Height</span>
              <span className="text-zinc-500 text-xs tabular-nums">{theme.lineHeight.toFixed(1)}</span>
            </div>
            <Slider
              value={[theme.lineHeight]}
              onValueChange={([v]) => set('lineHeight', v)}
              min={1.0}
              max={2.0}
              step={0.1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Section Spacing</span>
              <span className="text-zinc-500 text-xs tabular-nums">{theme.sectionSpacing.toFixed(1)}</span>
            </div>
            <Slider
              value={[theme.sectionSpacing]}
              onValueChange={([v]) => set('sectionSpacing', v)}
              min={0.2}
              max={2.0}
              step={0.1}
            />
          </div>
        </div>
      </div>

      {/* Show photo toggle */}
      <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
        <span className="text-zinc-300 text-sm">Show Photo</span>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={theme.showPhoto}
            onChange={(e) => set('showPhoto', e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-5 w-9 rounded-full bg-white/[0.08] peer-checked:bg-indigo-500 after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>
    </div>
  )
}
