import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Matikan rule agresif React 19/Compiler di nextVitals yang membuat ribuan false-positive di legacy useEffect
if (nextVitals[0] && nextVitals[0].rules) {
  nextVitals[0].rules["react-hooks/set-state-in-effect"] = "off";
  nextVitals[0].rules["react-hooks/preserve-manual-memoization"] = "off";
  nextVitals[0].rules["react-hooks/immutability"] = "off";
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
