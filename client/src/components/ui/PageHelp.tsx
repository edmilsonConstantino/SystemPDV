import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHelpProps {
  items: { label: string; text: string }[];
  className?: string;
}

export function PageHelp({ items, className }: PageHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/80', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-gray-100/60"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#B71C1C]/10">
          <Info className="h-3.5 w-3.5 text-[#B71C1C]" />
        </span>
        <span className="flex-1 text-[12px] font-bold uppercase tracking-wider text-gray-500">
          Como funciona este ecrã?
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-3">
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.label} className="flex gap-3">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#B71C1C]/50" />
                <div>
                  <span className="text-[12px] font-bold text-gray-700">{item.label}: </span>
                  <span className="text-[12px] text-gray-500">{item.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
