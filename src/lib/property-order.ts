type PropertyRecord = Record<string, unknown>;

function timestamp(value: unknown): number {
  try {
    const date = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) :
      value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function' ? value.toMillis() :
      value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate().getTime() : 0;
    return Number.isFinite(date) && date > 0 ? date : 0;
  } catch { return 0; }
}

const firstDate = (property: PropertyRecord, fields: string[]) => fields.map(field => timestamp(property[field])).find(Boolean) || 0;
const tieBreak = (a: PropertyRecord, b: PropertyRecord) => String(a.id || '').localeCompare(String(b.id || ''));

export function newestSubmittedFirst(a: PropertyRecord, b: PropertyRecord): number {
  const fields = ['moderationSubmittedAt', 'createdAt'];
  return firstDate(b, fields) - firstDate(a, fields) || tieBreak(a, b);
}

export function newestApprovedFirst(a: PropertyRecord, b: PropertyRecord): number {
  // Approved records already have a review timestamp. Fall back for legacy data
  // without excluding it through a Firestore orderBy on an optional field.
  const fields = ['moderationReviewedAt', 'approvedAt', 'createdAt', 'updatedAt'];
  return firstDate(b, fields) - firstDate(a, fields) || tieBreak(a, b);
}
