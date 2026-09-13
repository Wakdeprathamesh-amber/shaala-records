import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

export async function getTheme(): Promise<Theme> {
  const jar = await cookies();
  const v = jar.get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : DEFAULT_THEME;
}
