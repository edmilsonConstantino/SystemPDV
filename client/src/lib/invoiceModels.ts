export type InvoiceModelId = 'classic' | 'compact';

export type InvoiceParty = {
  name: string;
  addressLines?: string[];
  phone?: string;
  taxId?: string;
};

export type InvoiceLine = {
  name: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  total: number;
};

export type InvoiceData = {
  invoiceNo: string;
  issuedAt: Date;
  currencyLabel?: string; // ex: "MT"
  seller: InvoiceParty;
  customer?: InvoiceParty;
  paymentMethod?: string;
  lines: InvoiceLine[];
  subtotal: number;
  discount?: number;
  total: number;
  notes?: string[];
  qrValue?: string; // texto para QR (ex: tracking / URL / invoiceNo)
  barcodeValue?: string; // código para barcode
};

export const INVOICE_MODELS: Array<{ id: InvoiceModelId; label: string; description: string }> = [
  { id: 'classic', label: 'Clássico', description: 'Cabeçalho + tabela + QR/Barcode em baixo' },
  { id: 'compact', label: 'Compacto', description: 'Mais curto, focado em itens e total' },
];

