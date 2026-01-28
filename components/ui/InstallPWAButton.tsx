'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isInStandaloneMode = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      );
    };

    setIsStandalone(isInStandaloneMode());

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS prompt if on iOS and not installed
    if (iOS && !isInStandaloneMode()) {
      setShowInstallPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleClose = () => {
    setShowInstallPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !showInstallPrompt || sessionStorage.getItem('pwa-prompt-dismissed')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-2xl p-4 border border-blue-500">
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors"
          aria-label="Kapat"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-3 mb-3">
          <div className="bg-white/20 rounded-lg p-2">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Uygulamayı Yükle</h3>
            <p className="text-sm text-white/90">
              Luce İş Akışı uygulamasını telefonunuza yükleyip tam ekran deneyimi yaşayın
            </p>
          </div>
        </div>

        {isIOS ? (
          // iOS instructions
          <div className="bg-white/10 rounded-lg p-3 text-sm space-y-2 mb-3">
            <p className="font-medium">Nasıl Yüklenir:</p>
            <ol className="list-decimal list-inside space-y-1 text-white/90">
              <li>Aşağıdaki Paylaş butonuna <span className="inline-block">⎙</span> dokunun</li>
              <li>&quot;Ana Ekrana Ekle&quot; seçeneğini bulun</li>
              <li>&quot;Ekle&quot; butonuna dokunun</li>
            </ol>
          </div>
        ) : (
          // Android/Chrome button
          <button
            onClick={handleInstallClick}
            className="w-full bg-white text-blue-700 font-semibold py-3 px-4 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2 shadow-lg"
          >
            <Download className="w-5 h-5" />
            <span>Ana Ekrana Ekle</span>
          </button>
        )}

        <p className="text-xs text-white/70 mt-2 text-center">
          Offline çalışma • Daha hızlı yüklenme • Tam ekran
        </p>
      </div>
    </div>
  );
}
