import { getSecret } from '../../secrets/index.js'
import { getConfig } from '../../config/index.js'
import { logger } from '../../lib/logger.js'

export interface WeatherData {
  city: string
  temp: number
  feels_like: number
  condition: string
  icon: string
  humidity: number
  wind_speed: number
  forecast: Array<{
    date: string
    temp_min: number
    temp_max: number
    condition: string
    icon: string
  }>
}

export async function fetchWeather(city: string): Promise<WeatherData> {
  const apiKey = getSecret('OPENWEATHER_API_KEY') || getConfig('OPENWEATHER_API_KEY')
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY not configured')

  const currentRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
  )
  if (!currentRes.ok) throw new Error(`Weather API error: ${currentRes.status}`)
  const current = await currentRes.json()

  const forecastRes = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
  )
  if (!forecastRes.ok) throw new Error(`Forecast API error: ${forecastRes.status}`)
  const forecastData = await forecastRes.json()

  const dailyMap = new Map<string, any>()
  for (const entry of forecastData.list) {
    const date = entry.dt_txt.split(' ')[0]
    const hour = parseInt(entry.dt_txt.split(' ')[1].split(':')[0])
    if (!dailyMap.has(date) || Math.abs(hour - 12) < Math.abs(parseInt(dailyMap.get(date).dt_txt.split(' ')[1]) - 12)) {
      dailyMap.set(date, entry)
    }
  }

  const forecast = Array.from(dailyMap.entries()).slice(0, 5).map(([date, e]) => ({
    date,
    temp_min: e.main.temp_min,
    temp_max: e.main.temp_max,
    condition: e.weather[0].main,
    icon: e.weather[0].icon,
  }))

  return {
    city,
    temp: Math.round(current.main.temp),
    feels_like: Math.round(current.main.feels_like),
    condition: current.weather[0].main,
    icon: current.weather[0].icon,
    humidity: current.main.humidity,
    wind_speed: current.wind.speed,
    forecast,
  }
}
