import {propertyCategory} from '@/lib/property-category';
import {propertyPricing} from '@/lib/property-presentation';
import type {Property} from '@/services/propertyService';
export type DiscoveryFilters={type:'buy'|'rent';query:string;categories:string[];kinds:('buy'|'rent')[];condition:string;min:number;max:number;sort:string};
const unique=(values:string[])=>[...new Set(values)];
const amount=(value:string|null)=>value&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
export function readDiscoveryFilters(params:URLSearchParams):DiscoveryFilters {
 return {type:params.get('type')==='rent'?'rent':'buy',query:(params.get('q')||'').trim(),categories:unique((params.get('categories')||'').split(',').map(x=>x.toLowerCase()).filter(x=>['residential','commercial','industrial'].includes(x))),kinds:unique((params.get('types')||'').split(',').filter(x=>['buy','rent'].includes(x))) as ('buy'|'rent')[],condition:['New Project','Ready Project','Preleased'].includes(params.get('projectCondition')||'')?params.get('projectCondition')!:'',min:amount(params.get('minPrice')),max:amount(params.get('maxPrice')),sort:['price-low','price-high'].includes(params.get('sort')||'')?params.get('sort')!:'recommended'};
}
export function discoveryParams(filters:DiscoveryFilters){
 const p=new URLSearchParams({type:filters.type});if(filters.query.trim())p.set('q',filters.query.trim());if(filters.categories.length)p.set('categories',filters.categories.join(','));if(filters.kinds.length)p.set('types',filters.kinds.join(','));if(filters.condition)p.set('projectCondition',filters.condition);if(filters.min)p.set('minPrice',String(filters.min));if(filters.max)p.set('maxPrice',String(filters.max));if(filters.sort!=='recommended')p.set('sort',filters.sort);return p;
}
export function filterDiscoveryProperties(properties:Property[],filters:DiscoveryFilters){
 return properties.filter(property=>{
  if(filters.categories.length&&!filters.categories.some(category=>(propertyCategory(property.propertyCategory)||propertyCategory(property.propertyType))===category))return false;
  if(!filters.min&&!filters.max)return true;
  const price=propertyPricing(property).amount;return price!==null&&(!filters.min||price>=filters.min)&&(!filters.max||price<=filters.max);
 });
}
export function sortDiscoveryProperties(properties:Property[],sort:string){
 if(sort==='recommended')return [...properties];
 return properties.map(property=>({property,amount:propertyPricing(property).amount})).sort((a,b)=>{const x=a.amount,y=b.amount;if(x===null)return y===null?0:1;if(y===null)return -1;return sort==='price-high'?y-x:x-y;}).map(row=>row.property);
}
