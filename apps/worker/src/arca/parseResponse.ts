import * as cheerio from "cheerio";

export type ArcaParseResult =
  | { success: true; arcaId?: string }
  | { success: false; error: string };

export function parseArcaResponse(html: string): ArcaParseResult {
  const $ = cheerio.load(html);
  const errorEl = $(".errorMessage, .error").first();
  if (errorEl.length > 0) {
    return { success: false, error: errorEl.text().trim() };
  }
  const lastDelete = $('a[href*="eliminarDeduccion.do?id="]').last();
  const arcaId = lastDelete.attr("href")?.match(/id=(\d+)/)?.[1];
  return { success: true, arcaId };
}
