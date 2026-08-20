import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
export default (phase) => ({
  reactStrictMode: true,
  // Keep dev chunks separate from production builds. Running `next build`
  // while the dev server is active otherwise corrupts its Webpack module cache.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});
