export const TASK_TABLE_SEARCH_FIELDS = ['folderPath', 'fileName'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getTaskSearchScore(row, query) {
  const normalized = String(query ?? '').trim().toLowerCase();
  if (!normalized || !row) return 0;

  const terms = normalized.split(/\s+/).filter(Boolean);
  let score = 0;

  for (const field of TASK_TABLE_SEARCH_FIELDS) {
    const haystack = String(row[field] ?? '').trim().toLowerCase();
    if (!haystack) continue;

    for (const term of terms) {
      if (!haystack.includes(term)) continue;

      score += 1;
      if (haystack === term) {
        score += 2;
        continue;
      }

      const wordMatch = new RegExp(
        `(^|[\\s_/\\\\.-])${escapeRegExp(term)}($|[\\s_/\\\\.-])`,
        'i'
      );
      if (wordMatch.test(haystack)) score += 1;
    }
  }

  return score;
}

export function buildTaskTableSearchResult(rows, childrenCache, query, compareRows) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) {
    return {
      rows,
      childrenFilter: null,
      autoExpandIds: new Set(),
      isActive: false
    };
  }

  const childrenFilter = new Map();
  const autoExpandIds = new Set();
  const ranked = [];

  for (const [index, row] of rows.entries()) {
    const parentScore = getTaskSearchScore(row, trimmed);
    const children = childrenCache.get(row.id) || [];
    const matchingChildren = children.filter((child) => getTaskSearchScore(child, trimmed) > 0);
    const childScore = matchingChildren.reduce(
      (sum, child) => sum + getTaskSearchScore(child, trimmed),
      0
    );
    const totalScore = parentScore + childScore;

    if (totalScore <= 0) continue;

    ranked.push({ row, score: totalScore, index });

    if (matchingChildren.length > 0) {
      autoExpandIds.add(row.id);
      if (matchingChildren.length < children.length) {
        childrenFilter.set(row.id, new Set(matchingChildren.map((child) => child.id)));
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score || compareRows(a.row, b.row) || a.index - b.index);

  return {
    rows: ranked.map((item) => item.row),
    childrenFilter: childrenFilter.size > 0 ? childrenFilter : null,
    autoExpandIds,
    isActive: true
  };
}
