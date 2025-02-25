/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removing basePath to fix proxy issue
  // basePath: '/deepresearch',
  reactStrictMode: true,
};

module.exports = nextConfig;
