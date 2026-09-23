import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const PREFIX = "scrypt";

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${PREFIX}$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Events created before passwords were hashed stored the raw string.
  if (!stored.startsWith(`${PREFIX}$`)) return plain === stored;

  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;

  const key = await scryptAsync(plain, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
