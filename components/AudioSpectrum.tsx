import React, { useEffect, useRef, useCallback, memo } from 'react';

interface AudioSpectrumProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  enabled: boolean;
}

const AudioSpectrum: React.FC<AudioSpectrumProps> = ({ audioRef, isPlaying, enabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const barCount = 32;
    const barWidth = (width / barCount) * 0.6;
    const gap = (width / barCount) * 0.4;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
      }
      const average = sum / step;
      const barHeight = (average / 255) * height * 0.85;

      const x = width - (i * (barWidth + gap) + gap / 2) - barWidth;
      const y = height - barHeight;

      const gradient = ctx.createLinearGradient(0, height, 0, y);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.7)');

      ctx.fillStyle = gradient;
      
      const radius = barWidth / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    
    const audio = audioRef.current;
    if (!audio || isInitializedRef.current) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.85;

      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      isInitializedRef.current = true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioRef, enabled]);

  useEffect(() => {
    if (!enabled) return;
    
    const audioContext = audioContextRef.current;
    
    if (isPlaying) {
      if (audioContext?.state === 'suspended') {
        audioContext.resume();
      }
      if (!animationRef.current) {
        draw();
      }
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, draw, enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: isPlaying ? 1 : 0, transition: 'opacity 0.3s ease' }}
    />
  );
};

export default memo(AudioSpectrum);
