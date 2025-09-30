import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "frame-src 'self' https://*.daily.co",
              "connect-src 'self' https://*.daily.co wss://*.daily.co",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.daily.co",
              "worker-src 'self' blob:",
              "media-src 'self' https://*.daily.co blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
