import {structureUsesPlotArea} from './property-category';

export function supportsFurnishedChecklist(unitCondition:unknown,structure:unknown):boolean {
  return (unitCondition==='semi-furnished'||unitCondition==='furnished')&&!structureUsesPlotArea(structure);
}

export function activeFurnishedItems<T extends {checked?:unknown}>(items:unknown,unitCondition:unknown,structure:unknown):T[] {
  if(!supportsFurnishedChecklist(unitCondition,structure)||!Array.isArray(items))return [];
  return items.filter((item):item is T=>!!item&&typeof item==='object'&&(item as {checked?:unknown}).checked===true);
}
