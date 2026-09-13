"use client";

import { useRef, useState } from "react";

/**
 * The school's logo, for the top of every certificate.
 *
 * Shown on a white swatch rather than the page background: most school logos
 * are supplied as a JPEG with a white background, and on a dark surface they
 * appear as a white rectangle. Better to show the principal exactly what will
 * print on paper.
 */
export function LogoField({
  label,
  hint,
  currentSrc,
  chooseLabel,
  removeLabel,
  error,
}: {
  label: string;
  hint: string;
  currentSrc?: string | null;
  chooseLabel: string;
  removeLabel: string;
  error?: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentSrc ?? null);
  const [removed, setRemoved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} <span className="font-normal text-slate-400">{hint}</span>
      </span>

      <div className="mt-2 flex items-center gap-4">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded
                        border border-dashed border-slate-300 bg-white p-1 dark:border-slate-700">
          {preview && !removed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">बोधचिन्ह नाही</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            name="logo"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setRemoved(false);
              const reader = new FileReader();
              reader.onload = () => setPreview(String(reader.result));
              reader.readAsDataURL(f);
            }}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm text-slate-700
                       hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200
                       dark:hover:bg-slate-800"
          >
            {chooseLabel}
          </button>
          {preview && !removed ? (
            <button
              type="button"
              onClick={() => {
                setRemoved(true);
                setPreview(null);
                if (input.current) input.current.value = "";
              }}
              className="min-h-[36px] text-left text-sm text-red-600 hover:underline dark:text-red-400"
            >
              {removeLabel}
            </button>
          ) : null}
          {removed ? <input type="hidden" name="removeLogo" value="1" /> : null}
        </div>
      </div>

      {error ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
