import 'server-only';

type ReadMetric='property_list'|'property_detail'|'delivery_page';
const counters=new Map<ReadMetric,{queries:number;documents:number;estimatedDocumentReads:number}>();

/** Estimates exclude index billing, SDK retries and transaction retries. No customer data is logged. */
export function recordRead(metric:ReadMetric,documents:number):void {
  if(process.env.PROPBANK_READ_METRICS!=='1')return;
  const current=counters.get(metric)||{queries:0,documents:0,estimatedDocumentReads:0};
  current.queries++;current.documents+=documents;current.estimatedDocumentReads+=Math.max(1,documents);
  counters.set(metric,current);
  console.info('firestore_read_budget',{metric,...current});
}
export function readBudgetSnapshot(){return Object.fromEntries([...counters].map(([key,value])=>[key,{...value}]));}
