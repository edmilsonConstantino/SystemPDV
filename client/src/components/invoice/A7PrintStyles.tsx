import { useEffect } from 'react';

/**
 * Injeta CSS para impressão A7.
 * A7 = 74mm × 105mm.
 */
export function A7PrintStyles({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    const id = 'makira-a7-print-style';
    const prev = document.getElementById(id);
    if (prev) prev.remove();
    if (!enabled) return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
@page {
  size: 74mm 105mm;
  margin: 3mm;
}
@media print {
  html, body { height: auto !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mk-no-print { display: none !important; }
  .mk-print-root { margin: 0 !important; }
}
`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [enabled]);

  return null;
}

