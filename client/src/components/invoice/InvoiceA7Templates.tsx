import { QRCode } from 'react-qr-code';
import { formatCurrency } from '@/lib/utils';
import type { InvoiceData, InvoiceModelId } from '@/lib/invoiceModels';
import { BarcodeSvg } from './BarcodeSvg';

function HeadBlock({ data }: { data: InvoiceData }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] font-black uppercase tracking-wide">{data.seller.name}</p>
        {data.seller.addressLines?.map((l, idx) => (
          <p key={idx} className="text-[10px] text-neutral-700">
            {l}
          </p>
        ))}
        <div className="mt-1 space-y-0.5">
          {data.seller.phone && <p className="text-[10px] text-neutral-700">Tel: {data.seller.phone}</p>}
          {data.seller.taxId && <p className="text-[10px] text-neutral-700">NIF: {data.seller.taxId}</p>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-semibold text-neutral-600">FATURA</p>
        <p className="font-mono text-[12px] font-black">{data.invoiceNo}</p>
        <p className="mt-1 text-[10px] text-neutral-700">
          {data.issuedAt.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function LinesTable({ data }: { data: InvoiceData }) {
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-neutral-200">
      <div className="grid grid-cols-[1fr_38px_50px] gap-2 bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-800">
        <span>Descrição</span>
        <span className="text-right">Qtd</span>
        <span className="text-right">Total</span>
      </div>
      <div className="divide-y divide-neutral-200 bg-white">
        {data.lines.map((l, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_38px_50px] gap-2 px-2 py-1.5 text-[10px]">
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-950">{l.name}</p>
              <p className="text-[9px] text-neutral-600">
                {l.qty} {l.unit ?? ''} × {formatCurrency(l.unitPrice)}
              </p>
            </div>
            <p className="text-right font-bold text-neutral-900">{l.qty}</p>
            <p className="text-right font-bold text-neutral-900">{formatCurrency(l.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Totals({ data }: { data: InvoiceData }) {
  return (
    <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2">
      <div className="flex items-center justify-between text-[10px] text-neutral-800">
        <span className="font-semibold">Subtotal</span>
        <span className="font-bold">{formatCurrency(data.subtotal)}</span>
      </div>
      {typeof data.discount === 'number' && data.discount > 0 && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-800">
          <span className="font-semibold">Desconto</span>
          <span className="font-bold">- {formatCurrency(data.discount)}</span>
        </div>
      )}
      <div className="mt-2 flex items-end justify-between border-t border-neutral-200 pt-2">
        <span className="text-[10px] font-black uppercase tracking-wide">Total a pagar</span>
        <span className="font-heading text-[18px] font-black tabular-nums">{formatCurrency(data.total)}</span>
      </div>
      {data.paymentMethod && (
        <p className="mt-1 text-[9px] font-semibold text-neutral-700">Pagamento: {data.paymentMethod}</p>
      )}
    </div>
  );
}

function FooterCodes({ data }: { data: InvoiceData }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {data.qrValue ? (
        <div className="rounded-md border border-neutral-200 bg-white p-2">
          <p className="text-[9px] font-bold text-neutral-700">QR</p>
          <div className="mt-1 flex items-center justify-center">
            <QRCode value={data.qrValue} size={64} fgColor="#111111" bgColor="#ffffff" />
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
          <p className="text-center text-[9px] font-semibold text-neutral-600">QR desativado</p>
        </div>
      )}
      {data.barcodeValue ? (
        <div className="rounded-md border border-neutral-200 bg-white p-2">
          <p className="text-[9px] font-bold text-neutral-700">Código</p>
          <div className="mt-1 flex items-center justify-center">
            <BarcodeSvg value={data.barcodeValue} className="h-10 w-full" />
          </div>
          <p className="mt-1 text-center font-mono text-[9px] font-bold text-neutral-700">{data.barcodeValue}</p>
        </div>
      ) : (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
          <p className="text-center text-[9px] font-semibold text-neutral-600">Barcode desativado</p>
        </div>
      )}
    </div>
  );
}

export function InvoiceA7Template({
  model,
  data,
}: {
  model: InvoiceModelId;
  data: InvoiceData;
}) {
  if (model === 'compact') {
    return (
      <div className="mk-print-root w-[74mm] min-h-[105mm] bg-white p-2 text-black">
        <HeadBlock data={data} />

        <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1">
          <p className="text-[10px] font-bold text-neutral-900">Cliente</p>
          <p className="text-[10px] text-neutral-800">{data.customer?.name ?? 'Consumidor final'}</p>
          {data.customer?.phone && <p className="text-[9px] text-neutral-600">{data.customer.phone}</p>}
        </div>

        <LinesTable data={data} />
        <Totals data={data} />

        <div className="mt-2 rounded-md bg-neutral-100 px-2 py-1">
          <p className="text-center text-[9px] font-semibold text-neutral-700">Obrigado pela preferência</p>
        </div>

        <FooterCodes data={data} />
      </div>
    );
  }

  // classic
  return (
    <div className="mk-print-root w-[74mm] min-h-[105mm] bg-white p-2 text-black">
      <div className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-2">
        <HeadBlock data={data} />
      </div>

      <div className="mt-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-neutral-700">Faturar a</p>
            <p className="truncate text-[10px] font-semibold text-neutral-950">{data.customer?.name ?? 'Consumidor final'}</p>
            {data.customer?.phone && <p className="text-[9px] text-neutral-600">{data.customer.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold text-neutral-700">Moeda</p>
            <p className="text-[10px] font-black">{data.currencyLabel ?? 'MT'}</p>
          </div>
        </div>
      </div>

      <LinesTable data={data} />
      <Totals data={data} />

      {data.notes?.length ? (
        <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <p className="text-[9px] font-bold text-neutral-700">Observações</p>
          <ul className="mt-1 list-disc pl-4 text-[9px] text-neutral-700">
            {data.notes.slice(0, 3).map((n, idx) => (
              <li key={idx}>{n}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
          <p className="text-center text-[9px] font-semibold text-neutral-700">Documento gerado pelo sistema</p>
        </div>
      )}

      <FooterCodes data={data} />
    </div>
  );
}

