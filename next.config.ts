import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/submission/evaluate': ['./prompts/**/*', './grade_profile/**/*'],
    '/api/topic/generate': ['./prompts/**/*', './grade_profile/**/*'],
    '/api/tips': ['./grade_profile/**/*'],
    '/api/coach-help': ['./prompts/**/*', './grade_profile/**/*'],
  },
};

export default nextConfig;
