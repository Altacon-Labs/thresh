import { createHash, createPublicKey, verify } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ed25519SpkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');

export function stellarPublicKey(address: string): Buffer | null {
  if (!/^G[A-Z2-7]{55}$/.test(address)) return null;

  const decoded = Buffer.alloc(35);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const character of address) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      decoded[index++] = buffer >> bits;
      buffer &= (1 << bits) - 1;
    }
  }

  // Stellar account StrKeys use version 6 << 3 and a little-endian CRC16-XMODEM.
  if (decoded[0] !== 48) return null;
  let checksum = 0;
  for (const byte of decoded.subarray(0, 33)) {
    checksum ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      checksum = ((checksum << 1) ^ ((checksum & 0x8000) ? 0x1021 : 0)) & 0xffff;
    }
  }
  return checksum === decoded.readUInt16LE(33) ? decoded.subarray(1, 33) : null;
}

export function verifyStellarSignature(address: string, message: string, signature: string): boolean {
  const rawKey = stellarPublicKey(address);
  if (!rawKey || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
  const bytes = Buffer.from(signature, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== signature) return false;

  const publicKey = createPublicKey({
    key: Buffer.concat([ed25519SpkiPrefix, rawKey]), format: 'der', type: 'spki',
  });
  const digest = createHash('sha256').update('Stellar Signed Message:\n', 'utf8').update(message, 'utf8').digest();
  return verify(null, digest, publicKey, bytes);
}
