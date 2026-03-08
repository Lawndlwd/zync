import { z } from 'zod'
import { getPeopleClient } from './google-auth.js'

// --- contacts_search ---

export const contactsSearchSchema = z.object({
  query: z.string().describe('Search query (name, email, phone number)'),
  max_results: z.number().default(10).describe('Maximum number of results (default 10)'),
})

export async function contactsSearch(input: z.infer<typeof contactsSearchSchema>): Promise<string> {
  const people = getPeopleClient()

  const res = await people.people.searchContacts({
    query: input.query,
    pageSize: input.max_results,
    readMask: 'names,emailAddresses,phoneNumbers,organizations,photos',
  })

  const contacts = (res.data.results || []).map(r => {
    const p = r.person
    if (!p) return null
    return {
      resourceName: p.resourceName,
      name: p.names?.[0]?.displayName || '',
      emails: (p.emailAddresses || []).map(e => e.value),
      phones: (p.phoneNumbers || []).map(ph => ph.value),
      organization: p.organizations?.[0]?.name || '',
      title: p.organizations?.[0]?.title || '',
    }
  }).filter(Boolean)

  return JSON.stringify({ count: contacts.length, contacts })
}

// --- contacts_get ---

export const contactsGetSchema = z.object({
  resource_name: z.string().describe('Contact resource name (e.g. "people/c1234567890")'),
})

export async function contactsGet(input: z.infer<typeof contactsGetSchema>): Promise<string> {
  const people = getPeopleClient()

  const res = await people.people.get({
    resourceName: input.resource_name,
    personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,biographies,photos,urls',
  })

  const p = res.data
  return JSON.stringify({
    resourceName: p.resourceName,
    name: p.names?.[0]?.displayName || '',
    givenName: p.names?.[0]?.givenName || '',
    familyName: p.names?.[0]?.familyName || '',
    emails: (p.emailAddresses || []).map(e => ({ value: e.value, type: e.type })),
    phones: (p.phoneNumbers || []).map(ph => ({ value: ph.value, type: ph.type })),
    organization: p.organizations?.[0]?.name || '',
    title: p.organizations?.[0]?.title || '',
    addresses: (p.addresses || []).map(a => ({ formatted: a.formattedValue, type: a.type })),
    birthday: p.birthdays?.[0]?.date ? `${p.birthdays[0].date.year || '??'}-${p.birthdays[0].date.month}-${p.birthdays[0].date.day}` : '',
    bio: p.biographies?.[0]?.value || '',
    urls: (p.urls || []).map(u => u.value),
  })
}
