// In-memory contract double only. No driver, environment files or sockets.
const clone=value=>structuredClone(value);
function memoryMongo(){
 const state={mobile_claims:[],mobile_accounts:[],mobile_claims_control:[]};
 const faults={};let tail=Promise.resolve(),indexes=[];
 const match=(row,query)=>Object.entries(query).every(([key,value])=>row[key]===value);
 const db={databaseName:'isolated_mobile_test',collection(name){return {
  find(query){return {toArray:async()=>clone(state[name].filter(row=>match(row,query)))};},
  async findOne(query){if(faults.read)throw new Error('offline read');return clone(state[name].find(row=>match(row,query))||null);},
  listIndexes(){return {toArray:async()=>clone(name==='mobile_claims'?indexes:[{name:'_id_',key:{_id:1}}])};},
  async insertOne(row){
   if(state[name].some(other=>other._id===row._id)||name==='mobile_claims'&&state[name].some(other=>other.normalizedNumber===row.normalizedNumber||other.idempotencyId===row.idempotencyId||['owned','reserved'].includes(row.status)&&other.status===row.status&&other.firebaseUID===row.firebaseUID))throw Object.assign(new Error('duplicate'),{code:11000});
   state[name].push(clone(row));return {insertedId:row._id};
  },
  async updateOne(query,update){
   if(faults.confirm&&name==='mobile_claims')throw new Error('offline confirmation');
   const row=state[name].find(row=>match(row,query));if(!row)return {matchedCount:0};
   Object.assign(row,clone(update.$set||{}));for(const key of Object.keys(update.$unset||{}))delete row[key];
   return {matchedCount:1};
  },
  async deleteOne(query){const index=state[name].findIndex(row=>match(row,query));if(index<0)return {deletedCount:0};state[name].splice(index,1);return {deletedCount:1};},
 };}};
 const client={startSession(){return {async withTransaction(callback){
  const previous=tail;let release;tail=new Promise(resolve=>release=resolve);await previous;const before=clone(state);
  try{return await callback();}catch(error){Object.assign(state,before);throw error;}finally{release();}
 },async endSession(){}};}};
 return {db,client,state,faults,setIndexes:value=>indexes=clone(value)};
}
module.exports={memoryMongo};
