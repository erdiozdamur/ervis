import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
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
          borderRadius: 38,
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 108,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: -5,
            color: '#f0fdfa',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
            marginTop: -6,
          }}
        >
          E
        </div>
        <div
          style={{
            position: 'absolute',
            width: 22,
            height: 22,
            borderRadius: '999px',
            background: '#fb923c',
            bottom: 31,
            right: 30,
          }}
        />
      </div>
    ),
    size,
  );
}
