module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true, tsconfig: "<rootDir>/tsconfig.test.json" }],
  },
  moduleNameMapper: {
    "^@/test/(.*)$": "<rootDir>/test/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
