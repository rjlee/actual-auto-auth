const collectCoverage = process.env.JEST_COVERAGE === "true";

const config = {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  passWithNoTests: true,
  verbose: process.env.JEST_VERBOSE === "true",
  collectCoverage,
  coverageDirectory: "coverage",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};

if (collectCoverage) {
  config.coverageThreshold = {
    global: {
      branches: 70,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  };
}

module.exports = config;
