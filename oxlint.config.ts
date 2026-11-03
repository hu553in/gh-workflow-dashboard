import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  rules: {
    "func-style": "off",
    // The dashboard uses native dialogs for token prompts and errors.
    "no-alert": "off",
    "no-use-before-define": ["error", { functions: false }],
    "promise/avoid-new": "off",
  },
});
