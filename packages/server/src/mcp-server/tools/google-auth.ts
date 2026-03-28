import { google } from 'googleapis'
import { getSecret } from '../../secrets/index.js'

export function getGoogleAuth() {
  const clientId = getSecret('CHANNEL_GMAIL_CLIENT_ID')
  const clientSecret = getSecret('CHANNEL_GMAIL_CLIENT_SECRET')
  const refreshToken = getSecret('CHANNEL_GMAIL_REFRESH_TOKEN')
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google not configured. Connect Google in Settings first.')
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return auth
}

export function getGmailClient() {
  return google.gmail({ version: 'v1', auth: getGoogleAuth() })
}

export function getCalendarClient() {
  return google.calendar({ version: 'v3', auth: getGoogleAuth() })
}

export function getDriveClient() {
  return google.drive({ version: 'v3', auth: getGoogleAuth() })
}

export function getPeopleClient() {
  return google.people({ version: 'v1', auth: getGoogleAuth() })
}

export function getTasksClient() {
  return google.tasks({ version: 'v1', auth: getGoogleAuth() })
}

export function getYouTubeClient() {
  return google.youtube({ version: 'v3', auth: getGoogleAuth() })
}

export function getYouTubeAnalyticsClient() {
  return google.youtubeAnalytics({ version: 'v2', auth: getGoogleAuth() })
}
