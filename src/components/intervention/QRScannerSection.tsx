import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, X, CheckCircle, Flashlight, FlashlightOff, History, Camera, Barcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockProducts } from '@/lib/mockData';
import { Product } from '@/types/intervention';
import { toast } from 'sonner';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface ScanHistoryItem {
  code: string;
  product: Product | null;
  timestamp: Date;
  added: boolean;
}

interface QRScannerSectionProps {
  onProductScanned: (product: Product, qty: number) => void;
}

export function QRScannerSection({ onProductScanned }: QRScannerSectionProps) {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [scanMode, setScanMode] = useState<'qr' | 'barcode'>('qr');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    // Load scan history from localStorage
    const saved = localStorage.getItem('qr_scan_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setScanHistory(parsed.map((item: ScanHistoryItem) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        })));
      } catch (e) {
        console.error('Error loading scan history:', e);
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (scanHistory.length > 0) {
      localStorage.setItem('qr_scan_history', JSON.stringify(scanHistory.slice(0, 20)));
    }
  }, [scanHistory]);

  const findProduct = useCallback((code: string): Product | null => {
    // Try exact match first
    let product = mockProducts.find(
      p => p.ref.toLowerCase() === code.toLowerCase()
    );
    
    // Try partial match (code contains ref or ref contains code)
    if (!product) {
      product = mockProducts.find(
        p => code.toLowerCase().includes(p.ref.toLowerCase()) ||
             p.ref.toLowerCase().includes(code.toLowerCase())
      );
    }

    // Try EAN/barcode lookup (if stored in product data)
    // This would need a barcode field in Product type
    
    return product || null;
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    // Prevent duplicate scans
    if (decodedText === lastScannedCode) return;
    setLastScannedCode(decodedText);

    const product = findProduct(decodedText);
    
    // Add to history
    const historyItem: ScanHistoryItem = {
      code: decodedText,
      product,
      timestamp: new Date(),
      added: false,
    };
    setScanHistory(prev => [historyItem, ...prev].slice(0, 20));

    if (product) {
      setScannedProduct(product);
      toast.success(`Produit trouvé: ${product.label}`, {
        duration: 3000,
      });
      // Vibrate on success
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } else {
      toast.error(`Code non reconnu: ${decodedText}`, {
        description: 'Vérifiez le code ou utilisez l\'ajout manuel',
        duration: 4000,
      });
      // Single vibrate for error
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
    
    stopScanning();
  }, [findProduct, lastScannedCode]);

  const startScanning = async () => {
    setIsScanning(true);
    setLastScannedCode('');
    
    try {
      // Configure formats based on mode
      const formatsToSupport = scanMode === 'qr' 
        ? [Html5QrcodeSupportedFormats.QR_CODE]
        : [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ];

      const html5QrCode = new Html5Qrcode('qr-reader', {
        formatsToSupport,
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: scanMode === 'qr' 
            ? { width: 250, height: 250 }
            : { width: 300, height: 150 },
          aspectRatio: scanMode === 'qr' ? 1 : 2,
        },
        handleScanSuccess,
        () => {} // Ignore errors during scanning
      );

      // Get video track for flash control
      const videoElement = document.querySelector('#qr-reader video') as HTMLVideoElement;
      if (videoElement?.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        videoTrackRef.current = track;
      }
    } catch (error) {
      console.error('Error starting scanner:', error);
      toast.error('Impossible de démarrer la caméra', {
        description: 'Vérifiez les permissions caméra',
      });
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    // Turn off flash
    if (flashEnabled && videoTrackRef.current) {
      try {
        await (videoTrackRef.current as any).applyConstraints({
          advanced: [{ torch: false }],
        });
      } catch (e) {
        // Flash not supported
      }
    }
    setFlashEnabled(false);
    videoTrackRef.current = null;

    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }
    setIsScanning(false);
  };

  const toggleFlash = async () => {
    if (!videoTrackRef.current) return;

    try {
      const newFlashState = !flashEnabled;
      await (videoTrackRef.current as any).applyConstraints({
        advanced: [{ torch: newFlashState }],
      });
      setFlashEnabled(newFlashState);
    } catch (e) {
      toast.error('Flash non disponible sur cet appareil');
    }
  };

  const handleAddProduct = () => {
    if (scannedProduct && quantity) {
      onProductScanned(scannedProduct, parseFloat(quantity));
      
      // Mark as added in history
      setScanHistory(prev => prev.map(item => 
        item.product?.id === scannedProduct.id && !item.added
          ? { ...item, added: true }
          : item
      ));
      
      setScannedProduct(null);
      setQuantity('1');
    }
  };

  const handleHistorySelect = (item: ScanHistoryItem) => {
    if (item.product) {
      setScannedProduct(item.product);
      setShowHistory(false);
    }
  };

  const clearHistory = () => {
    setScanHistory([]);
    localStorage.removeItem('qr_scan_history');
    toast.success('Historique effacé');
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      {!isScanning && !scannedProduct && (
        <div className="flex gap-2 mb-2">
          <Button
            variant={scanMode === 'qr' ? 'worker' : 'worker-ghost'}
            size="sm"
            onClick={() => setScanMode('qr')}
            className="flex-1 gap-2"
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </Button>
          <Button
            variant={scanMode === 'barcode' ? 'worker' : 'worker-ghost'}
            size="sm"
            onClick={() => setScanMode('barcode')}
            className="flex-1 gap-2"
          >
            <Barcode className="w-4 h-4" />
            Code-barres
          </Button>
        </div>
      )}

      {/* Scanner Area */}
      {isScanning ? (
        <div className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50">
          <div className="relative">
            <div id="qr-reader" className="w-full" />
            
            {/* Scanner overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`border-2 border-primary rounded-lg ${
                  scanMode === 'qr' ? 'w-[250px] h-[250px]' : 'w-[300px] h-[150px]'
                }`}>
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br" />
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={toggleFlash}
                className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                {flashEnabled ? (
                  <FlashlightOff className="w-5 h-5" />
                ) : (
                  <Flashlight className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={stopScanning}
                className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 text-center text-sm text-muted-foreground">
            {scanMode === 'qr' 
              ? 'Pointez vers le QR code du produit'
              : 'Alignez le code-barres dans le cadre'
            }
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            variant="worker"
            size="full"
            onClick={startScanning}
            className="gap-3"
          >
            <Camera className="w-6 h-6" />
            {scanMode === 'qr' ? t('materials.scanQr') : 'Scanner code-barres'}
          </Button>

          {/* History Button */}
          {scanHistory.length > 0 && (
            <Button
              variant="worker-ghost"
              size="full"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-3"
            >
              <History className="w-5 h-5" />
              Historique ({scanHistory.length})
            </Button>
          )}
        </div>
      )}

      {/* Scan History */}
      {showHistory && scanHistory.length > 0 && (
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border/50 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Derniers scans</h4>
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              Effacer
            </Button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {scanHistory.map((item, index) => (
              <button
                key={`${item.code}-${index}`}
                onClick={() => handleHistorySelect(item)}
                disabled={!item.product}
                className={`w-full p-3 rounded-xl text-left transition-colors ${
                  item.product 
                    ? 'bg-muted/50 hover:bg-muted cursor-pointer' 
                    : 'bg-destructive/10 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {item.product?.label || 'Non reconnu'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {item.timestamp.toLocaleTimeString('fr-CH', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                    {item.added && (
                      <span className="text-xs text-success">Ajouté</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scanned Product */}
      {scannedProduct && (
        <div className="bg-card rounded-2xl p-4 shadow-card border border-success/30 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="font-bold">{scannedProduct.label}</p>
              <p className="text-sm text-muted-foreground">Ref: {scannedProduct.ref}</p>
              {scannedProduct.price && (
                <p className="text-sm text-primary font-medium">
                  CHF {scannedProduct.price.toFixed(2)} / {scannedProduct.unit}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">{t('materials.quantity')}</label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => setQuantity(prev => Math.max(0.5, parseFloat(prev) - 1).toString())}
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-12 text-base text-center flex-1"
                  min="0"
                  step="0.5"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => setQuantity(prev => (parseFloat(prev) + 1).toString())}
                >
                  +
                </Button>
              </div>
            </div>
            <div className="w-20">
              <label className="text-sm font-medium mb-1.5 block">{t('materials.unit')}</label>
              <Input
                value={scannedProduct.unit}
                readOnly
                className="h-12 text-base text-center bg-muted"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="worker-ghost"
              className="flex-1"
              onClick={() => setScannedProduct(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="worker"
              className="flex-1"
              onClick={handleAddProduct}
            >
              {t('common.add')}
            </Button>
          </div>
        </div>
      )}

      {/* Manual Entry Hint */}
      {!isScanning && !scannedProduct && !showHistory && (
        <p className="text-center text-sm text-muted-foreground">
          Pas de code? Utilisez l'ajout manuel ci-dessus.
        </p>
      )}
    </div>
  );
}
