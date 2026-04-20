import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ervis Calorie Tracker',
    short_name: 'Ervis',
    description: 'Ervis ile öğünlerini takip et, günlük kalori dengesini net gör.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#022c22',
    theme_color: '#0f766e',
    lang: 'tr',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
