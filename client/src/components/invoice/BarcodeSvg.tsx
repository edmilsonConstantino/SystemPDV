import { useEffect, useMemo, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export function BarcodeSvg({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const normalized = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    if (!ref.current) return;
    if (!normalized) return;

    try {
      JsBarcode(ref.current, normalized, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: 1.2,
        height: 36,
      });
    } catch {
      // se falhar, não renderiza barcode (mantém svg vazio)
    }
  }, [normalized]);

  if (!normalized) return null;

  return <svg ref={ref} className={className} />;
}

