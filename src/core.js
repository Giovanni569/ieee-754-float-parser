/**
 * Pure functions for serializing and parsing IEEE 754 binary floating point.
 *
 * Single precision: 1 sign bit, 8 exponent bits, 23 mantissa bits. Total 32 bits.
 * Double precision: 1 sign bit, 11 exponent bits, 52 mantissa bits. Total 64 bits.
 *
 * Implementation note on endianness: the natural, canonical representation is big-endian
 * (most significant byte first). IEEE 754 does not mandate a byte order, but network byte
 * order is big-endian and that is what every parser whose output you can eyeball expects.
 */

/**
 * @typedef {Object} FloatComponents
 * @property {0|1} sign            0 = positive, 1 = negative
 * @property {number} exponent     Raw biased exponent (0..255 for single, 0..2047 for double)
 * @property {bigint} mantissa     Raw integer mantissa bits
 * @property {('single'|'double')} precision
 */

/**
 * @typedef {Object} DecodedFloat
 * @property {0|1} sign
 * @property {number} exponent
 * @property {bigint} mantissa
 * @property {('single'|'double')} precision
 * @property {('finite'|'zero'|'subnormal'|'infinite'|'nan')} kind
 */

/**
 * Pack a bigint into a fixed-width big-endian byte array.
 *
 * @param {bigint} value  Non-negative value to encode.
 * @param {number} width  Number of bytes to emit.
 * @returns {number[]}    Array of unsigned byte values (big-endian).
 */
function toBytes(value, width) {
  const bytes = new Array(width).fill(0);
  let v = value;
  for (let i = width - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

/**
 * Build the raw integer value of an IEEE 754 float from components.
 *
 * @param {0|1} sign
 * @param {number} exponent  Raw biased exponent.
 * @param {bigint} mantissa  Raw mantissa bits.
 * @param {('single'|'double')} precision
 * @returns {bigint}
 */
export function packRaw(sign, exponent, mantissa, precision) {
  if (precision !== 'single' && precision !== 'double') {
    throw new TypeError(`precision must be 'single' or 'double', got ${String(precision)}`);
  }
  if (sign !== 0 && sign !== 1) throw new TypeError(`sign must be 0 or 1`);

  const expWidth = precision === 'single' ? 8 : 11;
  const manWidth = precision === 'single' ? 23 : 52;
  const expMax = (1 << expWidth) - 1;
  const manMax = (1 << manWidth) - 1;

  if (!Number.isInteger(exponent) || exponent < 0 || exponent > expMax) {
    throw new RangeError(`exponent out of range for ${precision}: ${exponent}`);
  }
  if (mantissa < 0n || mantissa > BigInt(manMax)) {
    throw new RangeError(`mantissa out of range for ${precision}`);
  }

  return (BigInt(sign) << BigInt(expWidth + manWidth)) |
         (BigInt(exponent) << BigInt(manWidth)) |
         mantissa;
}

/**
 * Serialize IEEE 754 components into a big-endian byte array.
 *
 * @param {0|1} sign
 * @param {number} exponent
 * @param {bigint} mantissa
 * @param {('single'|'double')} precision
 * @returns {number[]}  Array of unsigned bytes (length 4 or 8).
 */
export function serialize(sign, exponent, mantissa, precision) {
  const raw = packRaw(sign, exponent, mantissa, precision);
  const width = precision === 'single' ? 4 : 8;
  return toBytes(raw, width);
}

/**
 * Parse a big-endian byte array into IEEE 754 components and classification.
 *
 * @param {number[]|Uint8Array} bytes
 * @param {('single'|'double')} precision
 * @returns {DecodedFloat}
 */
export function parse(bytes, precision) {
  if (precision !== 'single' && precision !== 'double') {
    throw new TypeError(`precision must be 'single' or 'double', got ${String(precision)}`);
  }

  const width = precision === 'single' ? 4 : 8;
  if (!(bytes instanceof Uint8Array || Array.isArray(bytes))) {
    throw new TypeError('bytes must be an Array or Uint8Array');
  }
  if (bytes.length !== width) {
    throw new RangeError(`expected ${width} bytes for ${precision}, got ${bytes.length}`);
  }

  let raw = 0n;
  for (let i = 0; i < width; i++) {
    const b = bytes[i];
    if (!Number.isInteger(b) || b < 0 || b > 255) {
      throw new RangeError(`byte at index ${i} is out of range: ${b}`);
    }
    raw = (raw << 8n) | BigInt(b);
  }

  const expWidth = precision === 'single' ? 8 : 11;
  const manWidth = precision === 'single' ? 23 : 52;
  const expMax = (1 << expWidth) - 1;
  const manMask = (1n << BigInt(manWidth)) - 1n;

  const sign = Number((raw >> BigInt(expWidth + manWidth)) & 1n);
  const exponent = Number((raw >> BigInt(manWidth)) & BigInt(expMax));
  const mantissa = raw & manMask;

  let kind;
  if (exponent === 0) {
    kind = mantissa === 0n ? 'zero' : 'subnormal';
  } else if (exponent === expMax) {
    kind = mantissa === 0n ? 'infinite' : 'nan';
  } else {
    kind = 'finite';
  }

  return { sign, exponent, mantissa, precision, kind };
}
