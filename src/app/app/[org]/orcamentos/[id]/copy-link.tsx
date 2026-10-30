"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        aria-label="Link do orçamento"
        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className={buttonClass("primary", "px-3 py-1.5")}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
