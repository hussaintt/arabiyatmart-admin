import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Admin browser traffic is intentionally mediated by the App Router BFF under
// `/api/backend/*`; a broad `/api/*` rewrite would bypass its session/CSRF
// checks and also shadows the route handlers in production.
const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
