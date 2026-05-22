import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/admin-api/:path*',
        destination: `${process.env.ADMIN_API_URL || 'http://omegasuite.org:8888'}/:path*`,
      },
    ]
  },
}

export default nextConfig
