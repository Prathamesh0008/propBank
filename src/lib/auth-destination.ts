export function loginDestination(role: string, next = ''): string {
  // Keep intentional return links, while preventing external URLs and auth loops.
  if (next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') && !/^\/auth(?:[/?#]|$)/.test(next)) return next;
  return role === 'admin' ? '/admin' : '/';
}
