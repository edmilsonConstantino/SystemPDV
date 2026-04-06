import type { InvoiceModelId, InvoiceParty } from './invoiceModels';

const KEY = 'makira_invoice_settings_v1';

export type InvoiceSettings = {
  defaultModel: InvoiceModelId;
  seller: InvoiceParty;
  currencyLabel: string;
  defaultNotes: string[];
  showQr: boolean;
  showBarcode: boolean;
  transferAccounts: {
    mpesa?: string;
    emola?: string;
  };
};

const defaults: InvoiceSettings = {
  defaultModel: 'classic',
  currencyLabel: 'MT',
  seller: {
    name: 'Makira Sales',
    addressLines: [],
    phone: '',
    taxId: '',
  },
  defaultNotes: ['Obrigado pela preferência'],
  showQr: true,
  showBarcode: true,
  transferAccounts: {
    mpesa: '',
    emola: '',
  },
};

export function loadInvoiceSettings(): InvoiceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const v = JSON.parse(raw) as Partial<InvoiceSettings>;
    return {
      defaultModel: v.defaultModel === 'compact' ? 'compact' : 'classic',
      currencyLabel: typeof v.currencyLabel === 'string' && v.currencyLabel.trim() ? v.currencyLabel.trim() : defaults.currencyLabel,
      seller: {
        name: v.seller?.name?.trim() ? v.seller.name.trim() : defaults.seller.name,
        addressLines: Array.isArray(v.seller?.addressLines) ? v.seller!.addressLines!.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [],
        phone: typeof v.seller?.phone === 'string' ? v.seller.phone : '',
        taxId: typeof v.seller?.taxId === 'string' ? v.seller.taxId : '',
      },
      defaultNotes: Array.isArray(v.defaultNotes) ? v.defaultNotes.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, 5) : defaults.defaultNotes,
      showQr: typeof v.showQr === 'boolean' ? v.showQr : defaults.showQr,
      showBarcode: typeof v.showBarcode === 'boolean' ? v.showBarcode : defaults.showBarcode,
      transferAccounts: {
        mpesa: typeof (v as any).transferAccounts?.mpesa === 'string' ? (v as any).transferAccounts.mpesa.trim() : defaults.transferAccounts.mpesa,
        emola: typeof (v as any).transferAccounts?.emola === 'string' ? (v as any).transferAccounts.emola.trim() : defaults.transferAccounts.emola,
      },
    };
  } catch {
    return { ...defaults };
  }
}

export function saveInvoiceSettings(next: InvoiceSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota/private */
  }
}

