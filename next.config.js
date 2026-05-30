const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://deepresearch.ppq.ai' : undefined

};

// Only wrap with Sentry build integrations when the project has been
// fully provisioned (DSN + auth token). Otherwise the SDK still no-ops at
// runtime but we skip release creation and source-map upload during build,
// which fail until the Sentry project exists.
const enableSentryBuild = Boolean(
  process.env.SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN
);

module.exports = enableSentryBuild
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG || 'payperq',
      project: process.env.SENTRY_PROJECT || 'open-deep-research',
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig;
