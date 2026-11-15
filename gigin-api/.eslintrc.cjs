module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  extends: ["eslint:recommended", "google"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "max-len": ["error", { code: 120 }],
  },
};
