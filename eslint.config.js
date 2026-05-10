const tsParser = require("@typescript-eslint/parser");
const localRulesPlugin = require("eslint-plugin-local-rules");

module.exports = [
  {
    files: ["src/locators/apps/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
    },
    plugins: {
      "local-rules": localRulesPlugin,
    },
    rules: {
      "local-rules/realworld-locator-purity": "error",
    },
  },
  {
    files: ["src/benchmark/realworld-corpus.ts"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
    },
    plugins: {
      "local-rules": localRulesPlugin,
    },
    rules: {
      "local-rules/realworld-corpus-status": "error",
    },
  },
];
