/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Proxy API requests to the backend in development
  async rewrites() {
    return [
      {
        source: '/graphql',
        destination: 'http://localhost:8080/graphql',
      },
      {
        source: '/user-icon',
        destination: 'http://localhost:8080/user-icon',
      },
      {
        source: '/game-image',
        destination: 'http://localhost:8080/game-image',
      },
      {
        source: '/ical',
        destination: 'http://localhost:8080/ical',
      },
      {
        source: '/cal-sync',
        destination: 'http://localhost:8080/cal-sync',
      },
      {
        source: '/data/:path*',
        destination: 'http://localhost:8080/data/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
