import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Outer glow ring */}
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 60,
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
          }}
        />
        {/* Node dots — top-left */}
        <div
          style={{
            position: 'absolute',
            top: 42,
            left: 46,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: '#a78bfa',
            boxShadow: '0 0 10px 3px rgba(167,139,250,0.7)',
            display: 'flex',
          }}
        />
        {/* Node dot — top-right */}
        <div
          style={{
            position: 'absolute',
            top: 42,
            right: 46,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: '#a78bfa',
            boxShadow: '0 0 10px 3px rgba(167,139,250,0.7)',
            display: 'flex',
          }}
        />
        {/* Node dot — bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: 42,
            left: 46,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: '#a78bfa',
            boxShadow: '0 0 10px 3px rgba(167,139,250,0.7)',
            display: 'flex',
          }}
        />
        {/* Node dot — bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 42,
            right: 46,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: '#a78bfa',
            boxShadow: '0 0 10px 3px rgba(167,139,250,0.7)',
            display: 'flex',
          }}
        />
        {/* N lettermark */}
        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: 'white',
            fontFamily: 'sans-serif',
            letterSpacing: -4,
            lineHeight: 1,
            display: 'flex',
            textShadow: '0 0 30px rgba(167, 139, 250, 0.8)',
          }}
        >
          N
        </div>
      </div>
    ),
    { ...size }
  );
}
