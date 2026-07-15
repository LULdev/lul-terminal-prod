/**
 * Deduplicate meme templates by canonical path (prefers GIF over image).
 */

export function canonicalMemeKey(template) {
  return template.path.trim().toLowerCase();
}

export function deduplicateMemeTemplates(templates) {
  const map = new Map();

  for (const template of templates) {
    const key = canonicalMemeKey(template);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, template);
      continue;
    }

    if (existing.type === 'image' && template.type === 'gif') {
      map.set(key, template);
    }
  }

  return [...map.values()];
}

export function buildCatalogMeta(templates, meta = {}) {
  const staticCount = templates.filter((t) => t.type === 'image').length;
  const gifCount = templates.filter((t) => t.type === 'gif').length;

  return {
    ...meta,
    total: templates.length,
    staticCount,
    gifCount,
    templates,
  };
}