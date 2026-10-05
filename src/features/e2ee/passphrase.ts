import { MIN_PASSPHRASE_LENGTH } from '../../stores/e2ee'

export type PassphraseStrength = 'tooShort' | 'weak' | 'good' | 'strong'

/**
 * A rough guide only. The backup is encrypted with a key derived from the passphrase, so a
 * long passphrase (several words) is what keeps it safe if the server's data ever leaks.
 */
export function passphraseStrength(value: string): PassphraseStrength {
  const text = value.trim()
  if (text.length < MIN_PASSPHRASE_LENGTH) return 'tooShort'

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\s]/, /\s/, /[^\u0000-\u007F]/]
    .filter(pattern => pattern.test(text)).length
  const unique = new Set(text).size

  if (text.length >= 16 && unique >= 8) return 'strong'
  if (text.length >= 12 && classes >= 2 && unique >= 6) return 'good'
  return 'weak'
}
