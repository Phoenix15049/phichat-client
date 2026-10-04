/**
 * Encrypted stand-in for "no text" (e.g. a file or photo without caption).
 * The server requires non-empty ciphertext, so an empty caption is sent as this marker.
 */
export const EMPTY_MSG_MARKER = '\u200B'
