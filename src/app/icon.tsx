import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Glow backdrop */}
        <div
          style={{
            position: 'absolute',
            width: 18,
            height: 18,
            borderRadius: 9,
            background: 'rgba(139, 92, 246, 0.25)',
            display: 'flex',
          }}
        />
        {/* N lettermark */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'white',
            fontFamily: 'sans-serif',
            letterSpacing: -1,
            lineHeight: 1,
            display: 'flex',
            textShadow: '0 0 8px rgba(167, 139, 250, 0.9)',
          }}
        >
          N
        </div>
      </div>
    ),
    { ...size }
  );
}
