import React, { useState } from 'react';
import { Download, Share2, X, Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 3000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // If not installable and not iOS (e.g. unsupported desktop browser that hasn't fired beforeinstallprompt yet), don't show or show gentle button
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {justInstalled ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
          <Check className="w-3.5 h-3.5" />
          <span>Installé !</span>
        </div>
      ) : variant === 'full' ? (
        <button
          onClick={handleInstallClick}
          aria-label="Installer l'application sur votre appareil"
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-850 active:scale-98 transition-all text-xs font-semibold text-neutral-200 shadow-lg"
        >
          <Smartphone className="w-4 h-4 text-amber-400" />
          <span>Installer l'application</span>
        </button>
      ) : (
        <button
          onClick={handleInstallClick}
          aria-label="Installer CineScroll"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 text-neutral-300 hover:text-white active:scale-95 transition-all text-xs"
          title="Installer l'application"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-medium hidden sm:inline">Installer</span>
        </button>
      )}

      {/* iOS Installation Guide Modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-neutral-950 border border-neutral-800 p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-sm font-bold text-white">Installer sur iPhone / iPad</div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                aria-label="Fermer"
                className="w-7 h-7 rounded-full bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-300">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800/80">
                <div className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center text-amber-400 flex-shrink-0 font-bold text-[11px]">
                  1
                </div>
                <div className="flex-1">
                  Touchez le bouton <strong className="text-white">Partager</strong>{' '}
                  <Share2 className="w-3.5 h-3.5 inline text-amber-400 mx-0.5" /> dans la barre de Safari.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800/80">
                <div className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center text-amber-400 flex-shrink-0 font-bold text-[11px]">
                  2
                </div>
                <div className="flex-1">
                  Faites défiler vers le bas et sélectionnez{' '}
                  <strong className="text-white">« Sur l'écran d'accueil »</strong>.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
