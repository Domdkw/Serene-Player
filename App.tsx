
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, Play, Pause, SkipBack, SkipForward, Volume2, 
  Music, Clock, ListMusic, X, Repeat, Repeat1, Loader2, AlertCircle
} from 'lucide-react';
import { Track, PlaylistItem, PlaybackMode } from './types';
import { extractMetadata } from './utils/metadata';

const App: React.FC = () => {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  
  // Playlist states
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('list');
  
  // UI states
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);

  // Load playlist on mount
  useEffect(() => {
    fetch('./discList.json')
      .then(res => {
        if (!res.ok) throw new Error("Playlist file (discList.json) not found.");
        return res.json();
      })
      .then(data => setPlaylist(data))
      .catch(err => {
        console.error("Failed to load playlist", err);
        setErrorMessage("Could not load playlist. Check if discList.json exists.");
      });
  }, []);

  const loadMusicFromUrl = async (item: PlaylistItem, index: number) => {
    setErrorMessage(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoadingProgress(0);
    setCurrentIndex(index);
    setIsPlaying(false);
    
    try {
      const encodedUrl = encodeURI(item.url);
      const response = await fetch(encodedUrl, { signal });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}. Path: ${item.url}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream reader available.");

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (total) {
          setLoadingProgress(Math.round((receivedLength / total) * 100));
        }
      }

      if (signal.aborted) return;

      const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
      const file = new File([blob], item.name, { type: 'audio/mpeg' });
      
      const metadata = await extractMetadata(file);
      const objectUrl = URL.createObjectURL(file);
      
      const oldUrl = track?.objectUrl;
      
      setTrack({ objectUrl, metadata });
      setLoadingProgress(null);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = objectUrl;
        audioRef.current.load();
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn("Autoplay was prevented.", e);
        }
      }

      if (oldUrl) URL.revokeObjectURL(oldUrl);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Error loading music:", error);
      setLoadingProgress(null);
      setErrorMessage(error.message || "An error occurred while loading the track.");
      setIsPlaying(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMessage(null);
      setLoadingProgress(100);
      try {
        const metadata = await extractMetadata(file);
        const objectUrl = URL.createObjectURL(file);
        const oldUrl = track?.objectUrl;
        setTrack({ file, objectUrl, metadata });
        setCurrentIndex(-1);
        setLoadingProgress(null);
        if (audioRef.current) {
          audioRef.current.src = objectUrl;
          audioRef.current.load();
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
        if (oldUrl) URL.revokeObjectURL(oldUrl);
      } catch (err) {
        setErrorMessage("Failed to process the uploaded file.");
        setLoadingProgress(null);
      }
    }
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    loadMusicFromUrl(playlist[nextIndex], nextIndex);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadMusicFromUrl(playlist[prevIndex], prevIndex);
  };

  const togglePlay = () => {
    if (!audioRef.current || !track) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => {
        console.error("Playback error:", e);
      });
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current && time >= 0) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    if (time < 0) return "--:--";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeIndex = useMemo(() => {
    if (!track?.metadata.parsedLyrics.length) return -1;
    let index = -1;
    for (let i = 0; i < track.metadata.parsedLyrics.length; i++) {
      if (track.metadata.parsedLyrics[i].time <= currentTime) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [track, currentTime]);

  useEffect(() => {
    if (isAutoScrolling && activeLyricRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeElement = activeLyricRef.current;
      const scrollPos = activeElement.offsetTop - container.offsetHeight / 2 + activeElement.offsetHeight / 2;
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activeIndex, isAutoScrolling]);

  const onEnded = () => {
    if (playbackMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      handleNext();
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-black text-slate-200 relative overflow-hidden font-sans">
      
      {/* Wave Loading Bar */}
      {loadingProgress !== null && (
        <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">
          <div className="relative h-1.5 md:h-2 bg-white/5 overflow-hidden">
            <svg className="absolute w-[200%] h-full top-0 left-[-100%] animate-[wave_1.5s_linear_infinite]" viewBox="0 0 1200 24" preserveAspectRatio="none">
              <path d="M0 12 C 150 24 300 0 450 12 C 600 24 750 0 900 12 C 1050 24 1200 0 1350 12 V 24 H 0 Z" fill="white" fillOpacity="0.4" />
            </svg>
            <div className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.8)]" style={{ width: `${loadingProgress}%` }} />
          </div>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="fixed top-4 md:top-8 right-4 md:right-8 z-[60] bg-red-500/10 border border-red-500/50 backdrop-blur-xl px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-top-4">
          <AlertCircle size={18} className="text-red-500" />
          <p className="text-xs font-bold text-white max-w-[200px] leading-relaxed break-all">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dynamic Animated Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
        {track?.metadata.coverUrl ? (
          <div 
            className="absolute -inset-[150%] w-[400%] h-[400%] animate-ambient transition-all duration-1000"
            style={{
              backgroundImage: `url(${track.metadata.coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(50px) brightness(0.7)',
            }}
          />
        ) : (
          <div className="absolute inset-0">
            <div className="absolute inset-0 animate-rainbow-flow opacity-40" />
          </div>
        )}
      </div>

      {/* Main Content: Responsive Split */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden z-10">
        
        {/* Left Column: Fixed/Scrollable Sidebar (35% on Desktop) */}
        <section className="w-full md:w-[35%] lg:w-[30%] flex flex-col p-4 md:p-8 md:border-r border-white/10 bg-black/20 backdrop-blur-xl relative overflow-y-auto hide-scrollbar shrink-0 h-[60vh] md:h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 md:mb-10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shadow-inner">
                 <Music size={16} className="text-white" />
              </div>
              <span className="font-extrabold tracking-tighter text-white uppercase text-sm drop-shadow-lg">Serene</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-all cursor-pointer border border-white/10 active:scale-95">
                <Upload size={12} className="text-white" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Local</span>
                <input type="file" accept="audio/mpeg" className="hidden" onChange={handleFileUpload} />
              </label>
              <button 
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className={`p-2 rounded-full transition-all active:scale-95 ${isSidebarOpen ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
              >
                <ListMusic size={14} className={isSidebarOpen ? 'text-black' : 'text-white'} />
              </button>
            </div>
          </div>

          {/* Track Display */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 md:space-y-10 min-h-0">
            {track ? (
              <>
                <div className="relative group w-full aspect-square max-w-[200px] md:max-w-[280px] shrink-0">
                  <div className={`absolute -inset-4 md:-inset-8 opacity-20 blur-3xl rounded-full transition-all duration-1000 ${isPlaying ? 'scale-110' : 'scale-90'}`} style={{ backgroundColor: 'white' }} />
                  <div className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl border border-white/20 bg-black/40">
                    {track.metadata.coverUrl ? (
                      <img src={track.metadata.coverUrl} className={`w-full h-full object-cover transition-transform duration-[5s] ease-linear ${isPlaying ? 'scale-125' : 'scale-100'}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Music size={64} className="text-white/10" /></div>
                    )}
                  </div>
                </div>

                <div className="text-center space-y-2 w-full px-2">
                  <h1 className="text-xl md:text-2xl font-black text-white truncate drop-shadow-xl tracking-tight leading-tight">{track.metadata.title}</h1>
                  <p className="text-xs md:text-sm text-white/50 truncate font-bold tracking-[0.2em] uppercase">{track.metadata.artist}</p>
                </div>

                <div className="h-4 md:h-6 w-full text-center px-4">
                  <p className="text-[10px] md:text-xs font-bold text-white/70 italic line-clamp-1 drop-shadow-md tracking-wide">
                    {activeIndex !== -1 ? track.metadata.parsedLyrics[activeIndex].text : ""}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 text-white/20 text-center opacity-50">
                <div className="p-12 rounded-[2.5rem] border-2 border-dashed border-white/5 bg-white/[0.02]"><Music size={48} strokeWidth={1} /></div>
                <p className="text-[10px] uppercase tracking-[0.4em] font-black">Select Audio</p>
              </div>
            )}
          </div>

          {/* Controls - Fixed at bottom but part of scroll on very small screens */}
          <div className="mt-8 pt-6 border-t border-white/5 space-y-6 shrink-0">
            <div className="space-y-3">
              <input 
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={currentTime}
                disabled={!track}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-white h-1.5"
              />
              <div className="flex justify-between px-1">
                <span className="text-[10px] font-mono font-bold text-white/30">{formatTime(currentTime)}</span>
                <span className="text-[10px] font-mono font-bold text-white/30">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-around">
              <button 
                onClick={handlePrev}
                disabled={!playlist.length}
                className="text-white/30 hover:text-white transition-all disabled:opacity-5 active:scale-75"
              ><SkipBack size={28} /></button>
              
              <button 
                onClick={togglePlay}
                disabled={!track}
                className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-30"
              >
                {isPlaying ? <Pause size={28} md:size={32} fill="currentColor" /> : <Play size={28} md:size={32} fill="currentColor" className="ml-1" />}
              </button>
              
              <button 
                onClick={handleNext}
                disabled={!playlist.length}
                className="text-white/30 hover:text-white transition-all disabled:opacity-5 active:scale-75"
              ><SkipForward size={28} /></button>
            </div>

            <div className="flex items-center justify-between gap-4 bg-white/[0.03] p-3 rounded-2xl border border-white/[0.05] backdrop-blur-md">
              <div className="flex items-center gap-3 flex-1 px-1">
                <Volume2 size={16} className="text-white/30" />
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                  className="flex-1 cursor-pointer accent-white/30 h-1"
                />
              </div>
              
              <button 
                onClick={() => setPlaybackMode(prev => prev === 'list' ? 'single' : 'list')}
                className={`p-2 rounded-xl transition-all ${playbackMode === 'single' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:text-white'}`}
              >
                {playbackMode === 'list' ? <Repeat size={16} /> : <Repeat1 size={16} />}
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Lyrics (65% on Desktop) */}
        <section className="flex-1 relative overflow-hidden flex flex-col bg-transparent h-[40vh] md:h-full">
          <div 
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto px-6 md:px-20 py-[20vh] md:py-[45vh] hide-scrollbar"
            onMouseEnter={() => setIsAutoScrolling(false)}
            onMouseLeave={() => setIsAutoScrolling(true)}
          >
            {track && track.metadata.parsedLyrics.length > 0 ? (
              <div className={`flex flex-col min-h-full transition-all duration-700 ${isSidebarOpen ? 'items-start' : 'items-center justify-center'}`}>
                {track.metadata.parsedLyrics.map((line, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <div 
                      key={idx}
                      ref={isActive ? activeLyricRef : null}
                      onClick={() => handleSeek(line.time)}
                      className={`group relative py-2 md:py-4 cursor-pointer transition-all duration-700 text-center md:text-left ${
                        isActive ? 'text-white' : 'text-white/20'
                      }`}
                      style={{ 
                        marginBottom: isActive ? '2rem' : '1rem',
                        marginTop: isActive ? '2rem' : '1rem'
                      }}
                    >
                      {/* Precise Time Tag */}
                      <div className="absolute left-1/2 md:left-0 -top-6 md:-top-10 -translate-x-1/2 md:translate-x-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-[10px] text-white/80 font-mono bg-white/10 px-2 py-1 rounded-lg border border-white/10 backdrop-blur-xl z-20">
                        <Clock size={10} />
                        {formatTime(line.time)}
                      </div>
                      
                      <p className={`font-black leading-[1.1] md:leading-tight drop-shadow-2xl transition-all duration-700 select-none ${
                        isActive 
                          ? 'text-2xl md:text-[3vw] lg:text-[32px] opacity-100 scale-100 origin-center md:origin-left' 
                          : activeIndex !== -1 && (idx === activeIndex - 1 || idx === activeIndex + 1)
                            ? 'text-lg text-white/50 md:text-[2vw] lg:text-[28px] opacity-100 hover:text-white blur-0'
                            : 'text-lg md:text-[2vw] lg:text-[28px] opacity-80 hover:opacity-100 text-white/50  blur-0'
                      }`}>
                        {line.text}
                      </p>
                      
                      {/* Progress bar for active lyric */}
                      {isActive && track.metadata.parsedLyrics[idx + 1] && (
                        <div className="mt-2 w-full h-[2px] bg-white/20 relative overflow-hidden">
                          <div 
                            className="absolute top-0 left-0 h-full bg-white transition-all duration-100"
                            style={{
                              width: `${((currentTime - line.time + 0.1) / (track.metadata.parsedLyrics[idx + 1].time - line.time)) * 100}%`
                            }}//+0.1 是为了避免进度条到最后一个字时，进度条不显示，补上transition-all
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : track ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                <Loader2 size={32} className="animate-spin opacity-20" />
                <p className="text-sm md:text-xl italic font-medium tracking-tight opacity-40">No synchronized lyrics available</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/[0.05] gap-6">
                <div className="w-full max-w-md flex flex-col items-center">
                  <h2 className="text-xs font-black tracking-[0.4em] text-white/40 flex items-center gap-3 uppercase mb-6">
                    <ListMusic size={18} />
                    Music Library
                  </h2>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto hide-scrollbar w-full">
                    {playlist.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-white/10 text-center p-8 gap-6">
                        <Music size={64} strokeWidth={0.5} />
                        <p className="text-[10px] uppercase tracking-[0.3em] font-black">Empty Library</p>
                      </div>
                    ) : (
                      playlist.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => loadMusicFromUrl(item, idx)}
                          className={`w-full px-5 py-4 rounded-2xl flex items-center justify-between transition-all group border bg-white/[0.03] text-white/40 hover:bg-white/[0.08] hover:text-white border-white/[0.05]`}
                        >
                          <div className="text-left overflow-hidden pr-6">
                            <p className="text-sm font-black truncate leading-tight text-white">
                              {item.name}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest truncate font-bold opacity-60 mt-1">
                              {item.artist}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Top/Bottom Masking Gradients */}
          <div className="absolute top-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-24 md:h-64 bg-gradient-to-t from-black/40 via-black/20 to-transparent pointer-events-none z-10" />
        </section>
      </main>

      {/* Playlist Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-80 lg:w-96 z-[70] bg-black/40 backdrop-blur-[40px] border-l border-white/10 shadow-2xl transition-easeInOut duration-500 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col p-6 md:p-10">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xs font-black tracking-[0.4em] text-white/40 flex items-center gap-3 uppercase">
              <ListMusic size={18} />
              Music Library
            </h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2">
            {playlist.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/10 text-center p-8 gap-6">
                <Music size={64} strokeWidth={0.5} />
                <p className="text-[10px] uppercase tracking-[0.3em] font-black">Empty Library</p>
              </div>
            ) : (
              playlist.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => loadMusicFromUrl(item, idx)}
                  className={`w-full px-5 py-4 rounded-2xl flex items-center justify-between transition-all group border ${
                    currentIndex === idx 
                      ? 'bg-white text-black border-transparent shadow-2xl scale-[1.01]' 
                      : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.08] hover:text-white border-white/[0.05]'
                  }`}
                >
                  <div className="text-left overflow-hidden pr-6">
                    <p className={`text-sm font-black truncate leading-tight ${currentIndex === idx ? 'text-black' : 'text-white'}`}>
                      {item.name}
                    </p>
                    <p className={`text-[10px] uppercase tracking-widest truncate font-bold opacity-60 mt-1`}>
                      {item.artist}
                    </p>
                  </div>
                  {currentIndex === idx && isPlaying && (
                     <div className="flex gap-1 items-end h-4 shrink-0">
                        <div className="w-1 bg-current rounded-full animate-[music-bar_0.8s_ease-in-out_infinite]" />
                        <div className="w-1 bg-current rounded-full animate-[music-bar_0.6s_ease-in-out_infinite_0.1s]" />
                        <div className="w-1 bg-current rounded-full animate-[music-bar_0.9s_ease-in-out_infinite_0.2s]" />
                     </div>
                  )}
                </button>
              ))
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
             <p className="text-[9px] uppercase font-black tracking-[0.5em] text-white/10">Version 2.0 Lumina</p>
          </div>
        </div>
      </div>

      <audio 
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={onEnded}
      />

      <style>{`
        @keyframes music-bar {
          0%, 100% { height: 6px; }
          50% { height: 16px; }
        }
        @keyframes rainbow-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-rainbow-flow {
          background: linear-gradient(
            -45deg,
            #ff0000,
            #ff7300,
            #fffb00,
            #48ff00,
            #00ffd5,
            #002bff,
            #7a00ff,
            #ff00c8,
            #ff0000
          );
          background-size: 200% 200%;
          animation: rainbow-flow 10s ease infinite;
          filter: blur(100px) brightness(0.8);
        }
        @media (max-width: 768px) {
           input[type="range"]::-webkit-slider-thumb {
              height: 14px;
              width: 14px;
           }
        }
      `}</style>
    </div>
  );
};

export default App;
