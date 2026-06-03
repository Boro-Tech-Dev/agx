const { securityHeaders } = require('./lib/securityHeaders');

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  poweredByHeader: false,
  images: {
    formats: ['image/webp'],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@xyflow/react',
      'mermaid',
      '@fontsource/oswald',
      '@fontsource/jetbrains-mono',
    ],
  },
  // Do not use rewrites to agent-api: they are resolved at *build* time, so production
  // often pointed at the wrong host after redeploy. Use runtime proxy instead:
  // `app/api/[[...path]]/route.ts` and `app/health/route.ts` read AGENT_API_URL per request.
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
