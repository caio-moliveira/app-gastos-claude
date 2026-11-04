/** Escapa os curingas do LIKE/ILIKE (`\`, `%`, `_`) para buscar o texto literal. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
