import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": ["@storybook/addon-a11y", "@storybook/addon-docs", "@storybook/addon-mcp"],
  "framework": "@storybook/angular"
};
export default config;