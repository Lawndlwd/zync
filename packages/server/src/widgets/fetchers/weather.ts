// Open-Meteo — free, open-source, no API key needed
// Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=Paris
// Forecast:  https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&...

// WMO weather codes → condition + icon key
const WMO_CONDITIONS: Record<number, { condition: string; icon: string }> = {
  0: { condition: 'Clear', icon: 'clear' },
  1: { condition: 'Mostly clear', icon: 'clear' },
  2: { condition: 'Partly cloudy', icon: 'cloudy' },
  3: { condition: 'Overcast', icon: 'cloudy' },
  45: { condition: 'Foggy', icon: 'fog' },
  48: { condition: 'Fog', icon: 'fog' },
  51: { condition: 'Light drizzle', icon: 'rain' },
  53: { condition: 'Drizzle', icon: 'rain' },
  55: { condition: 'Heavy drizzle', icon: 'rain' },
  61: { condition: 'Light rain', icon: 'rain' },
  63: { condition: 'Rain', icon: 'rain' },
  65: { condition: 'Heavy rain', icon: 'rain' },
  71: { condition: 'Light snow', icon: 'snow' },
  73: { condition: 'Snow', icon: 'snow' },
  75: { condition: 'Heavy snow', icon: 'snow' },
  77: { condition: 'Snow grains', icon: 'snow' },
  80: { condition: 'Rain showers', icon: 'rain' },
  81: { condition: 'Rain showers', icon: 'rain' },
  82: { condition: 'Heavy showers', icon: 'rain' },
  85: { condition: 'Snow showers', icon: 'snow' },
  86: { condition: 'Heavy snow showers', icon: 'snow' },
  95: { condition: 'Thunderstorm', icon: 'thunder' },
  96: { condition: 'Thunderstorm + hail', icon: 'thunder' },
  99: { condition: 'Thunderstorm + heavy hail', icon: 'thunder' },
}

function wmoToCondition(code: number): { condition: string; icon: string } {
  return WMO_CONDITIONS[code] || { condition: 'Unknown', icon: 'cloudy' }
}

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
  // Step 1: geocode city name → coordinates
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`,
  )
  if (!geoRes.ok) throw new Error(`Geocoding error: ${geoRes.status}`)
  const geoData = await geoRes.json()
  if (!geoData.results?.length) throw new Error(`City not found: ${city}`)

  const { latitude, longitude, name } = geoData.results[0]

  // Step 2: fetch current + 5-day forecast
  const forecastRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&timezone=auto&forecast_days=5`,
  )
  if (!forecastRes.ok) throw new Error(`Forecast error: ${forecastRes.status}`)
  const data = await forecastRes.json()

  const current = data.current
  const { condition, icon } = wmoToCondition(current.weather_code)

  const forecast = (data.daily?.time || []).map((date: string, i: number) => {
    const fc = wmoToCondition(data.daily.weather_code[i])
    return {
      date,
      temp_min: Math.round(data.daily.temperature_2m_min[i]),
      temp_max: Math.round(data.daily.temperature_2m_max[i]),
      condition: fc.condition,
      icon: fc.icon,
    }
  })

  return {
    city: name || city,
    temp: Math.round(current.temperature_2m),
    feels_like: Math.round(current.apparent_temperature),
    condition,
    icon,
    humidity: current.relative_humidity_2m,
    wind_speed: current.wind_speed_10m,
    forecast,
  }
}
