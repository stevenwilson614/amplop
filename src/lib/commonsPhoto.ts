/** Real whale photos via Wikimedia Commons (loads in browser; run download script to bundle locally). */
export function commonsPhotoUrl(fileTitle: string, width = 1200): string {
  const file = fileTitle.startsWith("File:") ? fileTitle.slice(5) : fileTitle;
  const params = new URLSearchParams({ title: `Special:FilePath/${file}`, width: String(width) });
  return `https://commons.wikimedia.org/w/index.php?${params}`;
}
