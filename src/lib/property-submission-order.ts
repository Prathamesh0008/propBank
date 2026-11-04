type PropertySubmission = {id: string; createdAt?: unknown};

function submissionTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** createdAt is the persisted submission time; edits and moderation must not affect order. */
export function newestPropertySubmissions<T extends PropertySubmission>(properties: readonly T[]): T[] {
  return properties.map(property => ({property, time: submissionTime(property.createdAt)}))
    .sort((a, b) => {
      if (a.time !== b.time) {
        if (a.time === null) return 1;
        if (b.time === null) return -1;
        return b.time - a.time;
      }
      return a.property.id < b.property.id ? -1 : a.property.id > b.property.id ? 1 : 0;
    }).map(({property}) => property);
}
