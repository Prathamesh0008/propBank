import {newestPropertySubmissions} from './property-submission-order';

type DirectoryProperty = {id:string; createdAt?:unknown; moderationStatus?:string};
export type PropertyDirectoryTab = 'all' | 'pending';
export const propertyReviewStatus = (property:DirectoryProperty) => property.moderationStatus || 'unreviewed';

export function adminPropertyDirectory<T extends DirectoryProperty>(properties:readonly T[]) {
  // Each persisted document contributes one row and one count, even if batches overlap.
  const all = newestPropertySubmissions([...new Map(properties.map(property=>[property.id,property])).values()]);
  const pending = all.filter(property=>property.moderationStatus==='pending_review');
  return {all,pending};
}

export function visibleAdminProperties<T extends DirectoryProperty>(directory:{all:T[];pending:T[]},tab:PropertyDirectoryTab,filter:string) {
  return tab==='pending' ? directory.pending : directory.all.filter(property=>filter==='all'||propertyReviewStatus(property)===filter);
}

/** Apply only the persisted response; failed requests leave the directory untouched. */
export function replaceReviewedProperty<T extends {id:string}>(properties:T[]|undefined,reviewed:T):T[]|undefined {
  return properties?.map(property=>property.id===reviewed.id?{...property,...reviewed}:property);
}
