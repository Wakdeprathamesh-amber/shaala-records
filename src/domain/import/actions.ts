"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireCtx } from "@/lib/auth/session";
import { readWorkbook } from "@/domain/exports/workbook";
import { applyMapping, findHeaderRow, guessMapping } from "./parse";
import { commitBatch, validateStaged } from "./commit";
import { batchById, createBatch, stagedRowsFor } from "./repo";

export type UploadState = { error?: string };

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadRoll(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const ctx = await requireCtx();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "फाइल निवडा — Choose a file" };
  }
  if (file.size > MAX_BYTES) {
    return { error: `File is too large (max ${MAX_BYTES / 1024 / 1024}MB)` };
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { error: "Only .xlsx, .xls or .csv files can be imported" };
  }

  let parsed;
  try {
    parsed = await readWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch {
    return {
      error:
        "ही फाइल वाचता आली नाही — Could not read this file. Save it as .xlsx from Excel and try again.",
    };
  }

  // The header row is rarely row 1: sheets open with a school banner.
  const allRows = [parsed.headers, ...parsed.rows];
  const headerIndex = findHeaderRow(allRows);
  const mapping = guessMapping(allRows[headerIndex] ?? []);
  const staged = applyMapping(allRows, mapping, headerIndex);

  if (staged.length === 0) {
    return { error: "फाइलमध्ये विद्यार्थी सापडले नाहीत — No student rows found in that file" };
  }

  const batch = await createBatch(ctx, file.name, staged, {
    headerRow: headerIndex,
    columns: mapping,
  });

  revalidatePath("/import");
  redirect(`/import/${batch.id}`);
}

export async function commitImport(formData: FormData): Promise<void> {
  const ctx = await requireCtx();
  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) return;

  const batch = await batchById(ctx, batchId);
  if (!batch || batch.status === "committed") return;

  const staged = await stagedRowsFor(ctx, batchId);
  const validated = await validateStaged(ctx, staged);
  await commitBatch(ctx, batchId, validated);

  revalidatePath("/import");
  revalidatePath("/students");
  redirect(`/import/${batchId}`);
}
