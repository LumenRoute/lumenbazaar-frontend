import globals from "globals";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [".next/**", "coverage/**", "dist/**", "node_modules/**", "out/**"]
  },
  ...nextVitals,
  ...nextTypescript,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  }
];

export default config;
