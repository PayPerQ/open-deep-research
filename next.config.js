/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: 'https://deepresearch.ppq.ai',
  // Add basePath configuration for when served under /deepresearch
  basePath: process.env.NODE_ENV === 'production' ? '/deepresearch' : '',
  // Configure image domains
  images: {
    domains: ['deepresearch.ppq.ai'],
    path: process.env.NODE_ENV === 'production' ? '/deepresearch/_next/image' : '/_next/image',
    unoptimized: process.env.NODE_ENV !== 'production',
  }
};

module.exports = nextConfig;