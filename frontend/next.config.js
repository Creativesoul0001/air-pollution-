/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy API calls to the backend. On the host -> 127.0.0.1:8000; in Docker the
    // frontend service sets API_UPSTREAM=http://backend:8000 (see docker-compose.yml).
    const upstream = process.env.API_UPSTREAM || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${upstream}/api/:path*` }];
  },
};

module.exports = nextConfig;
