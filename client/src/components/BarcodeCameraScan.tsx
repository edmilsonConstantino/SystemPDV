import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Check, RotateCcw, ImageIcon, SwitchCamera } from 'lucide-react';
import { extractBarcodeFromCanvas } from '@/lib/barcodeScan';
import { cn } from '@/lib/utils';

interface BarcodeCameraScanProps {
  id?: string;
  onScan: (barcode: string) => void;
  onClose: () => void;
  /** Se true, fecha ao confirmar. Se false, mantém aberto para novo scan (ex: Scanner remoto) */
  closeOnConfirm?: boolean;
}

export function BarcodeCameraScan({ id = 'barcode-camera-scan', onScan, onClose, closeOnConfirm = true }: BarcodeCameraScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'capturing' | 'result' | 'error'>('loading');
  const [extractedCode, setExtractedCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMsg('');
    stopCamera();

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().then(() => setStatus('ready')).catch(() => setStatus('error'));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err.message || 'Câmera não disponível. Use HTTPS no celular.');
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [facingMode, stopCamera]);

  const captureAndExtract = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    setStatus('capturing');

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('ready');
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    try {
      const code = await extractBarcodeFromCanvas(canvas);
      if (code) {
        setExtractedCode(code);
        setStatus('result');
        setErrorMsg('');
      } else {
        const msg =
          'Código não encontrado. Sugestões: aproxime o código, melhore a iluminação, mantenha a imagem estável. Tente novamente ou digite manualmente.';
        setErrorMsg(msg);
        setStatus('ready');
        setShowManualInput(true);
      }
    } catch (e) {
      const errStr = e instanceof Error ? e.message : String(e);
      const isDetectError =
        errStr.includes('MultiFormat Readers') ||
        errStr.includes('detect the code') ||
        errStr.includes('No barcode');
      const msg = isDetectError
        ? 'Código não detectado. Sugestões: aproxime o código, melhore a iluminação, mantenha a imagem estável. Tente novamente ou digite manualmente.'
        : errStr || 'Não foi possível ler o código.';
      setErrorMsg(msg);
      setStatus('ready');
      setShowManualInput(true);
    }
  };

  const handleConfirm = () => {
    const code = extractedCode.trim();
    if (code) {
      onScan(code);
      if (closeOnConfirm) {
        stopCamera();
        onClose();
      } else {
        setExtractedCode('');
        setStatus('ready');
      }
    }
  };

  const handleRetry = () => {
    setExtractedCode('');
    setErrorMsg('');
    setShowManualInput(false);
    setManualCode('');
    setStatus('ready');
  };

  const handleManualConfirm = () => {
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      if (closeOnConfirm) {
        stopCamera();
        onClose();
      } else {
        setManualCode('');
        setErrorMsg('');
        setShowManualInput(false);
        setStatus('ready');
      }
    }
  };

  const flipCamera = () => {
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant={facingMode === 'environment' ? 'default' : 'outline'}
          size="sm"
          className="h-9 rounded-full px-4 font-semibold"
          onClick={() => setFacingMode('environment')}
          disabled={status === 'loading' || status === 'capturing'}
        >
          Traseira
        </Button>
        <Button
          type="button"
          variant={facingMode === 'user' ? 'default' : 'outline'}
          size="sm"
          className="h-9 rounded-full px-4 font-semibold"
          onClick={() => setFacingMode('user')}
          disabled={status === 'loading' || status === 'capturing'}
        >
          Frontal
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 rounded-full px-3 font-semibold"
          onClick={flipCamera}
          disabled={status === 'loading' || status === 'capturing'}
          title="Alternar câmera"
        >
          <SwitchCamera className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-2xl bg-black',
          'aspect-video min-h-[200px] max-md:aspect-auto max-md:min-h-[42dvh]',
        )}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ display: status === 'result' ? 'none' : 'block' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        {/* Moldura tipo visor — ajuda a alinhar o código */}
        {status !== 'result' && status !== 'loading' && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-[10%] max-md:p-[8%]"
            aria-hidden
          >
            <div className="aspect-[2.4/1] w-full max-w-md rounded-xl border-2 border-white/60 bg-black/10" />
          </div>
        )}
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-sm text-white">A abrir câmera…</p>
          </div>
        )}
        {status === 'capturing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="flex items-center gap-2 text-sm text-white">
              <ImageIcon className="h-5 w-5 animate-pulse" />
              A ler código…
            </p>
          </div>
        )}
        {status === 'result' && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/40">
            <Check className="h-16 w-16 text-emerald-400" />
          </div>
        )}
      </div>

      {status === 'result' ? (
        <div className="space-y-3">
          <Label>Verifique o código extraído:</Label>
          <Input
            value={extractedCode}
            onChange={(e) => setExtractedCode(e.target.value)}
            placeholder="Código de barras"
            className="font-mono text-lg"
            autoFocus
          />
          <div className="flex gap-2">
            <Button onClick={handleConfirm} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
            <Button variant="outline" onClick={handleRetry}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nova foto
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            onClick={captureAndExtract}
            disabled={status !== 'ready'}
            className="h-12 w-full rounded-xl text-base font-bold shadow-md"
            size="lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Capturar e ler
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Alinhe o código na moldura, mantenha firme e toque em capturar. Pode trocar entre câmera traseira e frontal acima.
          </p>
        </div>
      )}

      {errorMsg && (
        <p className="text-sm text-amber-600 dark:text-amber-500">{errorMsg}</p>
      )}

      {showManualInput && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <Label className="text-amber-700 dark:text-amber-400">Digitar manualmente</Label>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Código de barras"
              className="font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleManualConfirm()}
            />
            <Button onClick={handleManualConfirm} disabled={!manualCode.trim()}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={handleClose}>
        Fechar
      </Button>
    </div>
  );
}
