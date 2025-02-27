/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: 'https://deepresearch.ppq.ai',
  basePath: '/deepresearch',
  images: {
    domains: ['deepresearch.ppq.ai'],
    unoptimized: true
  }
};

module.exports = nextConfig;
