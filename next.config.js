/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://deepresearch.ppq.ai' : undefined

};

module.exports = nextConfig;
