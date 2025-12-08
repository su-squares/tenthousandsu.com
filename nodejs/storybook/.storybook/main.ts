import type { StorybookConfig } from "@storybook/html-vite";
import { mergeConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  framework: {
    name: "@storybook/html-vite",
    options: {}
  },
  stories: [
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  staticDirs: [
    {
      from: resolve(__dirname, "../../../assets"),
      to: "/assets"
    },
    {
      from: resolve(__dirname, "../../../build"),
      to: "/build"
    }
  ],
  async viteFinal(baseConfig) {
    return mergeConfig(baseConfig, {
      resolve: {
        alias: {
          "@assets": resolve(__dirname, "../../../assets"),
          "@modals": resolve(__dirname, "../../../assets/modals")
        }
      }
    });
  }
};

export default config;
