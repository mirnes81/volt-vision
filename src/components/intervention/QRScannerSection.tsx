import { useState, useEffect, useRef } from 'react';
import { QrCode, X, Package, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockProducts } from '@/lib/mockData';
import { Product } from '@/types/intervention';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerSectionProps {
  onProductScanned: (product: Product, qty: number) => void;
}

export function QRScannerSection({ onProductScanned }: QRScannerSectionProps) {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    setIsScanning(true);
    
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Find product by ref
          const product = mockProducts.find(
            p => p.ref.toLowerCase() === decodedText.toLowerCase()
          );
          
          if (product) {
            setScannedProduct(product);
            toast.success(`Produit trouvé: ${product.label}`);
          } else {
            toast.error('Produit non reconnu');
          }
          
          stopScanning();
        },
        () => {} // Ignore errors during scanning
      );
    } catch (error) {
      console.error('Error starting scanner:', error);
      toast.error('Impossible de démarrer la caméra');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }
    setIsScanning(false);
  };

  const handleAddProduct = () => {
    if (scannedProduct && quantity) {
      onProductScanned(scannedProduct, parseFloat(quantity));
      setScannedProduct(null);
      setQuantity('1');
    }
  };

  return (
    <div className="space-y-4">
      {/* Scanner Area */}
      {isScanning ? (
        <div className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50">
          <div className="relative">
            <div id="qr-reader" className="w-full" />
            <button
              onClick={stopScanning}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 text-center text-sm text-muted-foreground">
            Pointez la caméra vers le QR code du produit
          </div>
        </div>
      ) : (
        <Button
          variant="worker"
          size="full"
          onClick={startScanning}
          className="gap-3"
        >
          <QrCode className="w-6 h-6" />
          {t('materials.scanQr')}
        </Button>
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
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">{t('materials.quantity')}</label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-12 text-base text-center"
                min="0"
                step="0.1"
              />
            </div>
            <div className="flex-1">
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
      <p className="text-center text-sm text-muted-foreground">
        Pas de QR code? Utilisez l'ajout manuel ci-dessus.
      </p>
    </div>
  );
}
