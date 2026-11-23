import {publicPropertyText,type PropertyData} from './public-unit-privacy';
/** Existing Property Name is the only title. Building/society wording is public;
 * names containing unit identifiers are withheld whole, never regex-rewritten. */
export function safePublicPropertyName(property:PropertyData):string {
  return typeof property.title==='string'&&property.title.length<=200?publicPropertyText(property.title,property,'name'):'';
}
