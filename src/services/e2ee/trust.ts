/**
 * Which identity key we last saw for each peer ("trust on first use"), per signed-in account.
 * A different key later means the peer reset their key - or someone is trying to intercept -
 * so the chat shows a warning until the user acknowledges it.
 */
export type TrustRecord = { keyId: string; verified: boolean }

const storageKey = (ownerId: string) => `phi.e2ee.trust.${ownerId}`

function readAll(ownerId: string): Record<string, TrustRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(ownerId)) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(ownerId: string, records: Record<string, TrustRecord>) {
  try { localStorage.setItem(storageKey(ownerId), JSON.stringify(records)) } catch {}
}

export function getTrust(ownerId: string, peerId: string): TrustRecord | null {
  const record = readAll(ownerId)[peerId]
  return record && typeof record.keyId === 'string' ? record : null
}

export function setTrust(ownerId: string, peerId: string, record: TrustRecord) {
  const records = readAll(ownerId)
  records[peerId] = record
  writeAll(ownerId, records)
}
