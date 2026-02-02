import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

import baseConfig from "./base.js";

const reactRecommended = pluginReact.configs.recommended ?? {};
const reactHooksRecommended = pluginReactHooks.configs.recommended ?? {};

export const reactLibraryConfig = [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    settings: {
      ...(reactRecommended.settings ?? {}),
      react: {
        version: "detect",
        ...(reactRecommended.settings?.react ?? {}),
      },
    },
    rules: {
      ...(reactRecommended.rules ?? {}),
      ...(reactHooksRecommended.rules ?? {}),
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
  },
];

export default reactLibraryConfig;
