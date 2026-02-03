import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Package, ImageOff } from 'lucide-react';

interface SupplierProduct {
  id: string;
  supplier: string;
  reference: string;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  price: number | null;
  currency: string;
  stock_status: string | null;
  photo_url: string | null;
  product_url: string | null;
}

interface SupplierProductCardProps {
  product: SupplierProduct;
}

const supplierColors: Record<string, string> = {
  feller: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  hager: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  em: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export function SupplierProductCard({ product }: SupplierProductCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const [imageLoading, setImageLoading] = React.useState(true);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Image section */}
      <div className="relative h-40 bg-muted flex items-center justify-center">
        {product.photo_url && !imageError ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={product.photo_url}
              alt={product.name}
              className={`max-h-full max-w-full object-contain p-2 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <ImageOff className="w-8 h-8 mb-1" />
            <span className="text-xs">Pas d'image</span>
          </div>
        )}
        
        {/* Supplier badge */}
        <Badge 
          className={`absolute top-2 left-2 ${supplierColors[product.supplier] || ''}`}
        >
          {product.supplier.toUpperCase()}
        </Badge>
      </div>

      <CardContent className="p-3">
        {/* Reference */}
        <div className="text-xs font-mono text-muted-foreground mb-1">
          {product.reference}
        </div>

        {/* Name */}
        <h3 className="font-medium text-sm line-clamp-2 mb-2" title={product.name}>
          {product.name}
        </h3>

        {/* Category */}
        {product.category && (
          <div className="text-xs text-muted-foreground mb-2">
            {product.category}
            {product.subcategory && ` › ${product.subcategory}`}
          </div>
        )}

        {/* Price */}
        {product.price !== null && (
          <div className="font-semibold text-primary mb-2">
            {product.currency} {product.price.toFixed(2)}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {product.description}
          </p>
        )}

        {/* Actions */}
        {product.product_url && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => window.open(product.product_url!, '_blank')}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Voir sur le site
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
