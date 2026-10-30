/** Slug de /pages/ vira a URL do manual do produto; URL absoluta passa direto. */
export function urlManual(homepage: string, manual: string): string {
  if (/^https?:\/\//.test(manual)) return manual;
  return `${homepage.replace(/\/+$/, "")}/pages/${manual}.html`;
}
