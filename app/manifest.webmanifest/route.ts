import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    id: '/?source=pwa',
    name: 'Luce Mimarlık İş Akışı',
    short_name: 'Luce',
    description: 'Proje ve fatura yönetimi için iş akışı platformu',
    start_url: '/?source=pwa',
    display: 'standalone',
    display_override: ['standalone', 'fullscreen'],
    background_color: '#ffffff',
    theme_color: '#1e40af',
    orientation: 'portrait-primary',
    scope: '/',
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/desktop-1920x1080.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Luce İş Akışı - Desktop Görünüm',
      },
      {
        src: '/screenshots/mobile-750x1334.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Luce İş Akışı - Mobil Görünüm',
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
