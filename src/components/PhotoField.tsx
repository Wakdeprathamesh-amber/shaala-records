"use client";

import { useRef, useState } from "react";

import { MAX_PHOTO_EDGE, downscaleImage, formatBytes } from "@/lib/uploads/downscale";

/**
 * Student photograph: choose a file, see it immediately, or remove it.
 *
 * Never mandatory. Most of a school's existing register has no photograph at
 * all, and blocking a leaving certificate because a 2019 admission has no
 * picture would make the system unusable for exactly the records it is meant
 * to rescue. The certificate prints an empty box instead.
 */
export function PhotoField({
  label,
  hint,
  currentSrc,
  removeLabel,
  chooseLabel,
  error,
}: {
  label: string;
  hint: string;
  currentSrc?: string | null;
  removeLabel: string;
  chooseLabel: string;
  error?: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentSrc ?? null);
  const [removed, setRemoved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  /**
   * Shrinks the picture before it leaves the machine, then puts the smaller
   * file back into the input so the form submits that one. The school is on a
   * rural connection; uploading six megabytes for a stamp-sized print is not
   * something to make a clerk wait through.
   */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setProblem(null);
    setRemoved(false);

    try {
      const { file, dataUrl, before, after } = await downscaleImage(chosen, MAX_PHOTO_EDGE);
      setPreview(dataUrl);
      setNote(
        after < before
          ? `${formatBytes(before)} → ${formatBytes(after)}`
          : formatBytes(after),
      );

      // Replace the input's file list with the smaller one.
      const dt = new DataTransfer();
      dt.items.add(file);
      if (input.current) input.current.files = dt.files;
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not read that file.");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} <span className="font-normal text-slate-400">{hint}</span>
      </span>

      <div className="mt-2 flex items-start gap-4">
        <div
          className="flex h-[28mm] w-[22mm] shrink-0 items-center justify-center overflow-hidden
                     rounded border border-dashed border-slate-300 bg-slate-50 text-center
                     text-[10px] leading-tight text-slate-400 dark:border-slate-700
                     dark:bg-slate-950 dark:text-slate-500"
        >
          {preview && !removed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>छाया&shy;चित्र<br />नाही</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
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
                setNote(null);
                if (input.current) input.current.value = "";
              }}
              className="min-h-[36px] text-left text-sm text-red-600 hover:underline dark:text-red-400"
            >
              {removeLabel}
            </button>
          ) : null}

          {removed ? <input type="hidden" name="removePhoto" value="1" /> : null}
        </div>
      </div>

      {note && !removed ? (
        <p className="mt-1.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">{note}</p>
      ) : null}
      {problem ?? error ? (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{problem ?? error}</p>
      ) : null}
    </div>
  );
}
