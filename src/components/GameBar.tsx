import React from 'react';
import { Maximize2, Minimize2, MousePointer2, Keyboard, Gamepad2, Monitor, Smartphone, Gamepad, Square, Play } from 'lucide-react';
import { cn } from '../lib/utils';

interface GameBarProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  isFocusMode: boolean;
  onToggleFocus: () => void;
  isGesturesCaptured: boolean;
  onToggleGestures: () => void;
  onShowControls: () => void;
  deviceStats?: {
    desktop: number;
    mobile: number;
    console: number;
  };
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function GameBar({
  isPlaying,
  onPlay,
  onStop,
  isFocusMode,
  onToggleFocus,
  isGesturesCaptured,
  onToggleGestures,
  onShowControls,
  deviceStats,
  iframeRef
}: GameBarProps) {
  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        iframeRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      }
    }
  };

  return (
    <div className="bg-black/60 backdrop-blur-md border-t border-white/10 p-3 flex items-center justify-between gap-4 w-full">
      <div className="flex items-center gap-2">
        {isPlaying ? (
          <>
            <button
              onClick={onStop}
              className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-red-500/20"
              title="Stop Playing"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop</span>
            </button>
            
            <button
              onClick={onToggleFocus}
              className={cn(
                "p-2.5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border",
                isFocusMode 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-white/5 text-muted-foreground hover:text-white border-white/5"
              )}
            >
              {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFocusMode ? 'Exit Focus' : 'Focus Mode'}</span>
            </button>

            <button
              onClick={onToggleGestures}
              className={cn(
                "p-2.5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border",
                isGesturesCaptured 
                  ? "bg-accent text-white border-accent" 
                  : "bg-white/5 text-muted-foreground hover:text-white border-white/5"
              )}
            >
              <MousePointer2 className="w-4 h-4" />
              <span>{isGesturesCaptured ? 'Gestures Locked' : 'Lock Gestures'}</span>
            </button>

            <button
              onClick={onShowControls}
              className="p-2.5 rounded-xl bg-white/5 text-muted-foreground hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-white/5"
            >
              <Keyboard className="w-4 h-4" />
              <span>Controls</span>
            </button>
          </>
        ) : (
          <button
            onClick={onPlay}
            className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-primary/20"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Play Now</span>
          </button>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-1.5 group/stat">
          <Monitor className="w-3.5 h-3.5 group-hover/stat:text-primary transition-colors" />
          <span>{deviceStats?.desktop || 0}</span>
        </div>
        <div className="flex items-center gap-1.5 group/stat">
          <Smartphone className="w-3.5 h-3.5 group-hover/stat:text-primary transition-colors" />
          <span>{deviceStats?.mobile || 0}</span>
        </div>
        <div className="flex items-center gap-1.5 group/stat">
          <Gamepad className="w-3.5 h-3.5 group-hover/stat:text-primary transition-colors" />
          <span>{deviceStats?.console || 0}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleFullscreen}
          disabled={!isPlaying}
          className={cn(
            "p-2.5 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border",
            isPlaying 
              ? "bg-white/5 text-muted-foreground hover:text-white border-white/5" 
              : "opacity-50 cursor-not-allowed bg-white/5 text-muted-foreground border-white/5"
          )}
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="hidden xs:inline">Full Screen</span>
        </button>
      </div>
    </div>
  );
}
