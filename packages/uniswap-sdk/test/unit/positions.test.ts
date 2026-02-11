import { decodeInt24FromInfo, decodePositionInfo } from "@/helpers/positions";

const INT24_MIN = -0x800000;
const INT24_MAX = 0x7fffff;

const encodeInt24 = (value: number): bigint => {
  if (value < INT24_MIN || value > INT24_MAX) {
    throw new Error("int24 out of range");
  }

  if (value < 0) {
    return BigInt(0x1000000 + value);
  }

  return BigInt(value);
};

const buildPositionInfo = (params: {
  hasSubscriber: number;
  tickLower: number;
  tickUpper: number;
  poolId: bigint;
}): bigint => {
  const { hasSubscriber, tickLower, tickUpper, poolId } = params;

  return BigInt(hasSubscriber) | (encodeInt24(tickLower) << 8n) | (encodeInt24(tickUpper) << 32n) | (poolId << 56n);
};

describe("decodeInt24FromInfo", () => {
  it("decodes positive and negative int24 values", () => {
    const positiveInfo = encodeInt24(42);
    const negativeInfo = encodeInt24(-1);

    expect(decodeInt24FromInfo(positiveInfo, 0)).toBe(42);
    expect(decodeInt24FromInfo(negativeInfo, 0)).toBe(-1);
  });
});

describe("decodePositionInfo", () => {
  it("decodes packed position metadata", () => {
    const packed = buildPositionInfo({
      hasSubscriber: 1,
      tickLower: -120,
      tickUpper: 887,
      poolId: 0x1234n,
    });

    expect(decodePositionInfo(packed)).toEqual({
      hasSubscriber: 1,
      tickLower: -120,
      tickUpper: 887,
      poolId: 0x1234n,
    });
  });
});
