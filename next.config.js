const nextConfig = {
    reactStrictMode: true,
    basePath: '/deepresearch',
  
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [{ key: 'x-forwarded-host', value: 'ppq.ai' }],
        },
      ];
    },
  };
  
  module.exports = nextConfig;
  