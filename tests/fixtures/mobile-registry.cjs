const {createHash}=require('node:crypto');
const {users}=require('./native-server.cjs');
const key=phone=>createHash('sha256').update(`propbank:mobile:v1:${phone}`).digest('hex');
function registrySeed(profiles=users){
 const claims={},accounts={};
 for(const [uid,user]of Object.entries(profiles)){
  const phoneKey=key(user.phoneNumber);
  claims[phoneKey]={version:2,status:'owned',ownerUID:uid,createdAt:new Date(),updatedAt:new Date()};
  accounts[uid]={version:2,state:'owned',phoneKey,createdAt:new Date(),updatedAt:new Date()};
 }
 return {users:structuredClone(profiles),mobile_number_registry:claims,mobile_number_registry_accounts:accounts,mobile_number_registry_state:{main:{version:2,reservationPolicy:'legacy-conflict-reservations-v1',status:'active'}}};
}
module.exports={registrySeed,key};
