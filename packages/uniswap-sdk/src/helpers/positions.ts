/**
 * Decodes a signed 24-bit integer (`int24`) from a packed `bigint` at a given bit offset.
 *
 * @param info - The packed `bigint` containing the encoded data.
 * @param shift - The bit offset where the `int24` value begins.
 * @returns The decoded signed 24-bit integer as a number.
 *
 * @example
 * ```ts
 * const tickLower = decodeInt24FromInfo(info, 8);
 * const tickUpper = decodeInt24FromInfo(info, 32);
 * ```
 */
export function decodeInt24FromInfo(info: bigint, shift: number): number {
  const raw = (info >> BigInt(shift)) & 0xffffffn; // Extract 24 bits
  return raw >= 0x800000n ? Number(raw - 0x1000000n) : Number(raw); // Handle sign bit
}

/**
 * Decodes position metadata packed in a `uint256` returned by Uniswap V4's `getPoolAndPositionInfo`.
 * The structure of the encoded info is:
 * - bits 0–7: `hasSubscriber` flag (boolean in practice, stored as `uint8`)
 * - bits 8–31: `tickLower` (int24)
 * - bits 32–55: `tickUpper` (int24)
 * - bits 56–255: `poolId` (bytes25, used as bytes32 with padding)
 *
 * @param info - The packed position info as a `bigint`
 * @returns An object containing:
 *  - `hasSubscriber`: number (usually 0 or 1)
 *  - `tickLower`: number (int24)
 *  - `tickUpper`: number (int24)
 *  - `poolId`: bigint (25-byte identifier of the pool)
 *
 * @example
 * ```ts
 * const decoded = decodePositionInfo(info);
 * console.log(decoded.tickLower, decoded.poolId.toString(16));
 * ```
 */
export function decodePositionInfo(info: bigint): {
  hasSubscriber: number;
  tickLower: number;
  tickUpper: number;
  poolId: bigint;
} {
  return {
    hasSubscriber: Number(info & 0xffn),
    tickLower: decodeInt24FromInfo(info, 8),
    tickUpper: decodeInt24FromInfo(info, 32),
    poolId: info >> 56n,
  };
}
