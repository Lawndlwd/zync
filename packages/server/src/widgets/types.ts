export type WidgetType = 'weather' | 'football' | 'news' | 'finance'

export interface WidgetConfig {
  id: number
  type: WidgetType
  settings: Record<string, any>
  cached_data: any | null
  last_refreshed: string | null
  created_at: string
}

export interface WeatherSettings {
  city: string
}

export interface FootballSettings {
  teams: Array<{ id: number; name: string }>
  league?: number
}

export interface NewsSettings {
  topics: string[]
}

export interface FinanceSettings {
  focus: string[]
}
