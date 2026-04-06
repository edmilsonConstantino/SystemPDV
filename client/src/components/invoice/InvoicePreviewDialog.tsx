import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Printer, LayoutTemplate } from 'lucide-react';
import { A7PrintStyles } from './A7PrintStyles';
import { InvoiceA7Template } from './InvoiceA7Templates';
import { INVOICE_MODELS, type InvoiceData, type InvoiceModelId } from '@/lib/invoiceModels';
import { loadInvoiceSettings } from '@/lib/invoiceSettings';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: InvoiceData | null;
}) {
  const [model, setModel] = useState<InvoiceModelId>('classic');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');

  const safeData = useMemo(() => {
    if (!data) return null;
    const name = customerName.trim();
    const phone = customerPhone.trim();
    const taxId = customerTaxId.trim();
    const hasCustomer = !!name || !!phone || !!taxId;

    return {
      ...data,
      customer: hasCustomer
        ? {
            name: name || 'Cliente',
            phone: phone || undefined,
            taxId: taxId || undefined,
          }
        : data.customer,
    };
  }, [data, customerName, customerPhone, customerTaxId]);

  useEffect(() => {
    if (!open) return;
    const s = loadInvoiceSettings();
    setModel(s.defaultModel);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerTaxId('');
  }, [open]);

  const modelMeta = useMemo(() => INVOICE_MODELS.find((m) => m.id === model), [model]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <A7PrintStyles enabled={open} />
      <DialogContent className="max-w-5xl p-0">
        <div className="grid grid-cols-1 md:grid-cols-[380px_1fr]">
          <div className="mk-no-print border-b border-border bg-card p-5 md:border-b-0 md:border-r">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                Emitir fatura
              </DialogTitle>
              <DialogDescription>Escolhe o modelo e imprime em A7.</DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Modelo</p>
                <div className="mt-2">
                  <Select value={model} onValueChange={(v) => setModel(v as InvoiceModelId)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Escolher modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {modelMeta && (
                  <p className="mt-2 text-xs text-muted-foreground">{modelMeta.description}</p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <p className="text-sm font-black">Dados do cliente (opcional)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se não preencher, sai como “Consumidor final”.
                </p>
                <div className="mt-3 grid gap-3">
                  <div className="grid gap-2">
                    <Label>Nome</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+258 84 000 0000"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>NIF</Label>
                    <Input
                      value={customerTaxId}
                      onChange={(e) => setCustomerTaxId(e.target.value)}
                      placeholder="Opcional"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="gap-2 rounded-xl"
                  onClick={() => window.print()}
                  disabled={!safeData}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir (A7)
                </Button>
                <Badge variant="outline" className="rounded-xl">
                  Pré-visualização 1:1
                </Badge>
              </div>

              {!safeData && (
                <div className="rounded-2xl border border-dashed border-border p-4">
                  <p className="text-sm font-semibold text-muted-foreground">Sem dados de fatura</p>
                  <p className="mt-1 text-xs text-muted-foreground">Finalize uma venda para gerar o preview automaticamente.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-muted/20 p-5">
            <div className="mx-auto w-fit rounded-2xl border border-border bg-white p-3 shadow-sm">
              {safeData ? (
                <InvoiceA7Template model={model} data={safeData} />
              ) : (
                <div className="w-[74mm] min-h-[105mm] bg-white" />
              )}
            </div>

            <p className="mk-no-print mt-3 text-center text-xs text-muted-foreground">
              Dica: usa “Imprimir” e seleciona tamanho A7 (ou “Tamanho personalizado” 74×105mm).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

