// functions/.eslintrc.cjs
module.exports = {
  env: { es2022: true, node: true },
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  extends: ["eslint:recommended", "google"],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { "allowTemplateLiterals": true }],
    // ↓ turn off noisy rules you were hitting earlier
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "no-unused-vars": "warn"
  },
  overrides: [
    { files: ["**/*.spec.*"], env: { mocha: true }, rules: {} }
  ],
  globals: {}
};