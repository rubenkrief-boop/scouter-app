import type { NextConfig } from "next";

const securityHeaders = [
  // Empêche le navigateur de deviner le type MIME (protection contre le sniffing)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Protection contre le clickjacking (iframe)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Active la protection XSS du navigateur
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Contrôle les infos envoyées dans le header Referer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Empêche l'utilisation de fonctionnalités sensibles du navigateur
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Force HTTPS pendant 1 an
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Applique les headers de sécurité à toutes les routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
