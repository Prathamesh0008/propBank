export const PROPERTY_CATEGORIES = ['residential', 'commercial', 'industrial'] as const;
export type PropertyCategory = typeof PROPERTY_CATEGORIES[number];
export function propertyCategory(value: unknown): PropertyCategory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  return PROPERTY_CATEGORIES.includes(normalized as PropertyCategory) ? normalized as PropertyCategory : null;
}
export const PROPERTY_STRUCTURES: Record<PropertyCategory, readonly string[]> = {
  residential: ['Apartment', 'Independent House', 'Villa', 'Residential Plot'],
  commercial: ['Office', 'Shop', 'Showroom', 'Commercial Plot'],
  industrial: ['Warehouse', 'Factory', 'Industrial Shed', 'Industrial Plot'],
};
// Existing records keep their original structure values. Creation accepts both
// vocabularies, while the new forms present only the clearer canonical terms.
export const LEGACY_PROPERTY_STRUCTURES: Record<PropertyCategory, readonly string[]> = {
  residential: ['Flat', 'Bungalow'],
  commercial: ['Office', 'Shop'],
  industrial: ['Unit', 'RCC Shed', 'Land'],
};
export const PROPERTY_CONFIGURATIONS = ['Studio','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK'] as const;
export function structureUsesPlotArea(value:unknown){return typeof value==='string'&&/plot|land/i.test(value);}
