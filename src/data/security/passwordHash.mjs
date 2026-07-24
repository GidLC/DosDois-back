import crypto from 'crypto';

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const scryptAsync = (password, salt) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt);

  return [
    HASH_PREFIX,
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt,
    derivedKey.toString('hex'),
  ].join('$');
};

const timingSafeEqualHex = (a, b) => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');

  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const verifyPassword = async (password, storedHash) => {
  if (!password || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  if (!storedHash.startsWith(`${HASH_PREFIX}$`)) {
    return {
      valid: timingSafeEqualHex(sha256(password), storedHash),
      needsRehash: true,
    };
  }

  const [prefix, n, r, p, salt, hash] = storedHash.split('$');
  if (prefix !== HASH_PREFIX || !salt || !hash) {
    return { valid: false, needsRehash: false };
  }

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      Buffer.from(hash, 'hex').length,
      { N: Number(n), r: Number(r), p: Number(p) },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
  });

  const valid = timingSafeEqualHex(derivedKey.toString('hex'), hash);
  const needsRehash =
    Number(n) !== SCRYPT_OPTIONS.N ||
    Number(r) !== SCRYPT_OPTIONS.r ||
    Number(p) !== SCRYPT_OPTIONS.p;

  return { valid, needsRehash };
};

