/**
 * Which identity key we last saw for each peer ("trust on first use"), per signed-in account.
 * A different key later means the peer reset their key - or someone is trying to intercept -
 * so the chat shows a warning until the user acknowledges it.
 */
export type TrustRecord = {
  keyId: string
  verified: boolean
  /** Earlier keys of the peer the user accepted, so their old messages stay trusted. */
  known?: string[]
}

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

/** Whether `keyId` is one the user has seen and accepted for the peer (nothing known yet counts as yes). */
export function isKnownKey(ownerId: string, peerId: string, keyId: string): boolean {
  const record = getTrust(ownerId, peerId)
  return !record || record.keyId === keyId || !!record.known?.includes(keyId)
}

export function setTrust(ownerId: string, peerId: string, record: TrustRecord) {
  const records = readAll(ownerId)
  records[peerId] = record
  writeAll(ownerId, records)
}
