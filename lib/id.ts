export function generateBlockId(): string {
  const hasCrypto = typeof globalThis === 'object' && 'crypto' in globalThis
  const cryptoObj = hasCrypto ? globalThis.crypto : undefined

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
