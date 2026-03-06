import type { CvTheme, CvTemplateId } from '@/types/jobs'
import { CV_THEMES, FONT_OPTIONS, TEMPLATE_INFO } from '@/lib/cv-themes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

interface ThemeCustomizerProps {
  theme: CvTheme
  onChange: (theme: CvTheme) => void
}

const templateIds = Object.keys(TEMPLATE_INFO) as CvTemplateId[]

export function ThemeCustomizer({ theme, onChange }: ThemeCustomizerProps) {
  const set = <K extends keyof CvTheme>(key: K, value: CvTheme[K]) => {
    onChange({ ...theme, [key]: value })
  }

  const themesForTemplate = CV_THEMES.filter(t => t.template === theme.template)

  return (
    <div className="space-y-6">
      {/* Template selector */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">Template</Label>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {templateIds.map((id) => {
            const info = TEMPLATE_INFO[id]
            return (
              <button
                key={id}
                onClick={() => {
                  const firstTheme = CV_THEMES.find(t => t.template === id)
                  if (firstTheme) onChange(firstTheme)
                }}
                className={`rounded-md border px-2.5 py-2 text-left transition-all ${
                  theme.template === id
                    ? 'ring-2 ring-indigo-500 border-indigo-500/50 bg-white/[0.06]'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-zinc-100 text-sm font-medium block">{info.label}</span>
                <span className="text-zinc-500 text-[10px] leading-tight block mt-0.5">{info.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Color presets for current template */}
      {themesForTemplate.length > 1 && (
        <div className="space-y-2">
          <Label className="text-zinc-400 text-xs uppercase tracking-wider">Color Preset</Label>
          <div className="flex flex-wrap gap-1.5">
            {themesForTemplate.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onChange(preset)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-all ${
                  theme.id === preset.id
                    ? 'ring-2 ring-indigo-500 border-indigo-500/50 bg-white/[0.06]'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex gap-0.5 shrink-0">
                  <span className="block size-3 rounded-sm" style={{ backgroundColor: preset.accentColor }} />
                  <span className="block size-3 rounded-sm" style={{ backgroundColor: preset.primaryColor }} />
                  <span className="block size-3 rounded-sm" style={{ backgroundColor: preset.backgroundColor }} />
                </div>
                <span className="text-zinc-200">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom colors */}
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
