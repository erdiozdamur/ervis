import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0f766e 0%, #115e59 52%, #022c22 100%)',
        }}
      >
        <div
          style={{
            width: 392,
            height: 392,
            borderRadius: '28%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(150deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%)',
            boxShadow: '0 36px 80px rgba(2, 44, 34, 0.38)',
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: 238,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: -10,
              color: '#0f766e',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
              marginTop: -10,
            }}
          >
            E
          </div>
          <div
            style={{
              position: 'absolute',
              width: 56,
              height: 56,
              borderRadius: '999px',
              background: '#f97316',
              bottom: 74,
              right: 76,
              boxShadow: '0 8px 22px rgba(124, 45, 18, 0.35)',
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
