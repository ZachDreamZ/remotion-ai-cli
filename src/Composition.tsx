import React from 'react';
import { AbsoluteFill, Video, Audio, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import project from '../.remotion-ai/project.json';

// ─── Helpers ───

function parseBg(bg: string | null): React.CSSProperties {
  if (!bg) return {};
  if (bg.startsWith('gradient:')) {
    const parts = bg.replace('gradient:', '').split(':');
    return { background: `linear-gradient(180deg, ${parts[0] || '#000'} 0%, ${parts[1] || '#111'} 100%)` };
  }
  return { backgroundColor: bg };
}

function getGlow(color: string, intensity: number = 20): string {
  return `0 0 ${intensity}px ${color}, 0 0 ${intensity * 2}px ${color}40`;
}

// ─── Particles ───

const PARTICLE_COUNT = 12;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: (i * 137.508) % 100,
  y: (i * 97.31) % 100,
  size: 2 + (i % 4),
  speed: 0.3 + (i % 3) * 0.2,
  opacity: 0.15 + (i % 5) * 0.05,
}));

function Particles({ frame, accent }: { frame: number; accent?: string | null }) {
  const color = accent || '#00FF88';
  return (
    <>
      {particles.map((p, i) => {
        const y = (p.y + frame * p.speed * 0.1) % 110 - 5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: p.opacity,
              filter: `blur(${p.size > 3 ? 1 : 0}px)`,
            }}
          />
        );
      })}
    </>
  );
}

// ─── Scanline overlay ───

function Scanlines() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}

// ─── Progress bar ───

function ProgressBar({ frame, totalFrames }: { frame: number; totalFrames: number }) {
  const progress = (frame / totalFrames) * 100;
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 101 }}>
      <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#00FF88', transition: 'width 0.1s' }} />
    </div>
  );
}

// ─── Main Composition ───

export const MainComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Find active text for background
  const activeText = project.timeline.texts.find(t => frame >= t.startFrame && frame <= t.endFrame);
  const bgStyle = parseBg(activeText?.bg || null);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', ...bgStyle }}>
      {/* Particles */}
      <Particles frame={frame} accent={activeText?.accent} />

      {/* Audio Tracks - loop if shorter than video */}
      {project.timeline.audio.map((track) => {
        const assetPath = project.assets[track.assetId];
        if (!assetPath) return null;
        const src = staticFile(assetPath.replace('/', ''));
        return (
          <Audio
            key={track.id}
            src={src}
            startFrom={0}
            volume={track.volume}
          />
        );
      })}

      {/* Video Clips */}
      {project.timeline.clips.map((clip) => {
        if (frame < clip.startFrame || frame > clip.endFrame) return null;
        const opacity = interpolate(frame, [clip.startFrame, clip.startFrame + 10, clip.endFrame - 10, clip.endFrame], [0, 1, 1, 0]);
        const assetPath = project.assets[clip.assetId];
        return (
          <AbsoluteFill key={clip.id} style={{ opacity }}>
            <Video
              src={staticFile(assetPath.replace('/', ''))}
              startFrom={clip.trimStart}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </AbsoluteFill>
        );
      })}

      {/* Text Overlays */}
      {project.timeline.texts.map((text) => {
        if (frame < text.startFrame || frame > text.endFrame) return null;

        const textFrame = frame - text.startFrame;
        const duration = text.endFrame - text.startFrame;
        const progress = textFrame / duration;
        const accent = text.accent || text.style.color;

        let style: React.CSSProperties = {
          color: text.style.color,
          fontSize: text.style.fontSize,
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 900,
          textAlign: 'center',
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          textShadow: getGlow(accent, 15),
          padding: '0 40px',
        };

        // ─── Effects ───

        if (text.effect === 'kinetic') {
          const translateY = interpolate(progress, [0, 0.15, 0.85, 1], [60, 0, 0, -20]);
          const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `translateY(${translateY}px)`, opacity };
        }
        else if (text.effect === 'liquid') {
          const clipPct = interpolate(progress, [0, 0.4, 1], [0, 100, 100]);
          style = { ...style, clipPath: `inset(0 ${100 - clipPct}% 0 0)` };
        }
        else if (text.effect === 'shader') {
          const s = interpolate(progress, [0, 0.2, 1], [0.6, 1.05, 1]);
          const blur = interpolate(progress, [0, 0.2, 1], [12, 0, 0]);
          const opacity = interpolate(progress, [0, 0.15, 1], [0, 1, 1]);
          style = { ...style, transform: `scale(${s})`, filter: `blur(${blur}px)`, opacity };
        }
        else if (text.effect === 'typewriter') {
          const charsToShow = Math.floor(interpolate(textFrame, [0, duration * 0.75], [0, text.content.length], { extrapolateRight: 'clamp' }));
          const displayText = text.content.slice(0, charsToShow);
          const cursorVisible = Math.floor(textFrame / 6) % 2 === 0 && charsToShow < text.content.length;
          return (
            <AbsoluteFill key={text.id} style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
              <div style={style}>
                {displayText}
                {cursorVisible && <span style={{ borderRight: `3px solid ${accent}`, marginLeft: 2 }}>&nbsp;</span>}
              </div>
            </AbsoluteFill>
          );
        }
        else if (text.effect === 'wave') {
          const chars = text.content.split('').map((char, i) => {
            const delay = i * 0.06;
            const yOffset = Math.sin((progress + delay) * Math.PI * 5) * 12;
            const charOpacity = interpolate(progress, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);
            return React.createElement('span', {
              key: i,
              style: { display: 'inline-block', transform: `translateY(${yOffset}px)`, opacity: charOpacity },
            }, char);
          });
          return (
            <AbsoluteFill key={text.id} style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
              <div style={style}>{chars}</div>
            </AbsoluteFill>
          );
        }
        else if (text.effect === 'glitch') {
          const glitchAmt = (1 - progress) * 8;
          const x1 = Math.sin(textFrame * 7.3) * glitchAmt;
          const y1 = Math.cos(textFrame * 11.1) * glitchAmt * 0.5;
          const skew = Math.sin(textFrame * 5.7) * glitchAmt * 0.3;
          const opacity = interpolate(progress, [0, 0.04, 1], [0, 1, 1]);
          // RGB split
          const splitAmt = glitchAmt * 0.4;
          style = {
            ...style,
            opacity,
            transform: `translate(${x1}px, ${y1}px) skewX(${skew}deg)`,
            textShadow: `${splitAmt}px 0 #ff0040, ${-splitAmt}px 0 #00ffff, 0 0 20px ${accent}`,
          };
        }
        else if (text.effect === 'bounce') {
          let bounceY: number;
          if (progress < 0.4) {
            bounceY = interpolate(progress, [0, 0.2, 0.4], [150, -25, 0], { extrapolateRight: 'clamp' });
          } else {
            bounceY = interpolate(progress, [0.4, 0.55, 0.7, 0.85, 1], [0, -10, 3, -1, 0], { extrapolateRight: 'clamp' });
          }
          const opacity = interpolate(progress, [0, 0.08, 1], [0, 1, 1]);
          style = { ...style, transform: `translateY(${bounceY}px)`, opacity };
        }
        else if (text.effect === 'scale') {
          let s: number;
          if (progress < 0.15) {
            s = interpolate(progress, [0, 0.15], [0, 1.2], { extrapolateRight: 'clamp' });
          } else if (progress < 0.25) {
            s = interpolate(progress, [0.15, 0.25], [1.2, 0.95], { extrapolateRight: 'clamp' });
          } else if (progress < 0.35) {
            s = interpolate(progress, [0.25, 0.35], [0.95, 1], { extrapolateRight: 'clamp' });
          } else {
            s = 1;
          }
          const opacity = interpolate(progress, [0, 0.08, 0.95, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `scale(${s})`, opacity };
        }
        else if (text.effect === 'flash') {
          const flash = progress < 0.1 ? interpolate(progress, [0, 0.05, 0.1], [0, 1, 0.3]) : interpolate(progress, [0.1, 0.2], [0.3, 1], { extrapolateRight: 'clamp' });
          style = { ...style, opacity: flash };
        }
        else if (text.effect === 'pulse') {
          const pulseScale = 1 + Math.sin(progress * Math.PI * 6) * 0.05;
          const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `scale(${pulseScale})`, opacity };
        }
        else if (text.effect === 'slide-left') {
          const x = interpolate(progress, [0, 0.2, 0.8, 1], [-120, 0, 0, 120]);
          const opacity = interpolate(progress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `translateX(${x}%)`, opacity };
        }
        else if (text.effect === 'slide-right') {
          const x = interpolate(progress, [0, 0.2, 0.8, 1], [120, 0, 0, -120]);
          const opacity = interpolate(progress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `translateX(${x}%)`, opacity };
        }
        else if (text.effect === 'zoom-in') {
          const s = interpolate(progress, [0, 0.5, 1], [1, 2.5, 3]);
          const opacity = interpolate(progress, [0, 0.1, 0.8, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `scale(${s})`, opacity };
        }
        else if (text.effect === 'zoom-out') {
          const s = interpolate(progress, [0, 0.5, 1], [3, 1.5, 1]);
          const opacity = interpolate(progress, [0, 0.1, 0.8, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `scale(${s})`, opacity };
        }
        else if (text.effect === 'shake') {
          const shakeX = Math.sin(textFrame * 15) * 8 * (1 - progress);
          const shakeY = Math.cos(textFrame * 12) * 6 * (1 - progress);
          const opacity = interpolate(progress, [0, 0.05, 0.9, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `translate(${shakeX}px, ${shakeY}px)`, opacity };
        }
        else if (text.effect === 'spin') {
          const rotation = interpolate(progress, [0, 1], [0, 360]);
          const opacity = interpolate(progress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
          style = { ...style, transform: `rotate(${rotation}deg)`, opacity };
        }
        else {
          // Default fade
          const opacity = interpolate(frame, [text.startFrame, text.startFrame + 8, text.endFrame - 8, text.endFrame], [0, 1, 1, 0]);
          style = { ...style, opacity };
        }

        // ─── Mask ───
        if (text.mask && text.mask.type !== 'none') {
          const radius = text.mask.radius || 20;
          if (text.mask.type === 'rounded') {
            style = { ...style, borderRadius: `${radius}px` };
          } else if (text.mask.type === 'circle') {
            style = { ...style, borderRadius: '50%' };
          } else if (text.mask.type === 'diagonal') {
            style = { ...style, clipPath: 'polygon(0 0, 100% 0, 100% 80%, 0 100%)' };
          }
        }

        // ─── Blend Mode ───
        if (text.blend && text.blend.mode !== 'normal') {
          style = { ...style, mixBlendMode: text.blend.mode.replace('-', ''), opacity: text.blend.opacity || 0.8 };
        }

        return (
          <AbsoluteFill
            key={text.id}
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={style}>{text.content}</div>
          </AbsoluteFill>
        );
      })}

      {/* Scanlines */}
      <Scanlines />

      {/* Progress bar */}
      <ProgressBar frame={frame} totalFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
