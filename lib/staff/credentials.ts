import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export function generatePassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

export function generatePIN(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function hashPIN(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}
