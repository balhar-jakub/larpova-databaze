// Mock window for SSR (needed by html-to-draftjs, draft-js, etc.)
if (typeof window === 'undefined') {
  global.window = {
    location: { protocol: 'https:', hostname: 'localhost', host: 'localhost', href: 'https://localhost/' },
  };
}

import withGraphQL from 'next-plugin-graphql';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Map old next-routes URL patterns to Next.js 14 file-system routing
  async rewrites() {
    return [
      // Root homepage
      { source: '/', destination: '/homepage' },

      // Legacy Java app URLs → new routes
      { source: '/hra.jsp', destination: '/gameDetail', has: [{ type: 'query', key: 'id' }] },
      { source: '/home', destination: '/' },

      // Game detail: /larp/:slug/cs/:id → /gameDetail?id=:id
      { source: '/larp/:slug/cs/:id', destination: '/gameDetail?id=:id' },

      // Event detail: /event/:slug/:id → /eventDetail?id=:id
      { source: '/event/:slug/:id', destination: '/eventDetail?id=:id' },

      // Group detail: /group/:id → /groupDetail?id=:id
      { source: '/group/:id', destination: '/groupDetail?id=:id' },

      // Games ladder: /games/:ladderType → /games?ladderType=:ladderType
      { source: '/games/:ladderType', destination: '/games?ladderType=:ladderType' },

      // Profile variants (must be before generic /profile/:id)
      { source: '/profile/current', destination: '/profile?id=current' },
      { source: '/profile/settings', destination: '/profile?id=settings' },
      { source: '/profile/changePassword', destination: '/profile?id=changePassword' },

      // User profile: /profile/:id → /profile?id=:id
      { source: '/profile/:id', destination: '/profile?id=:id' },

      // Game edit: /gameEdit/:id → /gameEdit?id=:id
      { source: '/gameEdit/:id', destination: '/gameEdit?id=:id' },

      // Event edit: /eventEdit/:id → /eventEdit?id=:id
      { source: '/eventEdit/:id', destination: '/eventEdit?id=:id' },
    ];
  },
};

export default withGraphQL(nextConfig);
