import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/95 border border-amber-500/40 text-amber-300 text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      <span>Mode hors-ligne actif</span>
    </div>
  );
};
