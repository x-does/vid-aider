import type { NextConfig } from 'next';

const isGithubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  images: { unoptimized: true },
  basePath: isGithubPages ? '/vid-aider' : '',
  assetPrefix: isGithubPages ? '/vid-aider/' : '',
};

export default nextConfig;
