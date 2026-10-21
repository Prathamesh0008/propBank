// Test-only HTTP adapter. No Firebase, R2 or mail network access; never imported by src.
const http=require('node:http');
const {isolated,users,properties,defaults,route}=require('./native-server.cjs');
let app;
function reset(){app=isolated({users:{...users,broker:{...users.other,uid:'broker',name:'Test Broker',email:'broker@test.invalid',role:'agent'},broker2:{...users.other,uid:'broker2',name:'Second Broker',email:'broker2@test.invalid',role:'agent'},customer:{...users.other,uid:'customer',name:'Customer',email:'customer@test.invalid'}},properties:{P:{...properties.P,title:'Acceptance Home',configuration:'2BHK',monthlyRent:'70000',rentalStatus:'available',tenants:[],images:['/assets/hero-realestate.jpg']},Q:{...properties.P,id:'Q',title:'Assigned Home',monthlyRent:'30000',agreementStartDate:'2026-01-01',agreementEndDate:'2027-01-01'},R:{...properties.P,id:'R',title:'Owner rented home',ownerUID:'other',tenants:[{userUID:'owner',isActive:true,email:'owner@test.invalid'}]}},siteSettings:{main_settings:{...defaults,id:'main_settings',heroTitle:'Propbank acceptance',heroSubtitle:'Isolated browser workflows',bannerImages:[]}}});app.claims.owner={emailVerified:true};}
reset();
http.createServer(async(req,res)=>{
 try{
  if(req.url==='/reset'){reset();res.end('ok');return;}
  if(req.url==='/long-property'){Object.assign(app.state.properties.P,{title:'Long property name '.repeat(12),buildingName:'Long building name '.repeat(12),address:'Long address with unit and location '.repeat(12)});res.end('ok');return;}
  if(req.url==='/health'){res.end('ok');return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const pathname=new URL(req.url,'http://local').pathname.replace(/^\/api\//,'');
  const matchers=[['enquiries/([^/]+)','enquiries/[id]','id'],['media/(?!session$|legacy$)([^/]+)','media/[id]','id'],['service-requests/([^/]+)','service-requests/[id]','id'],['tenants/([^/]+)','tenants/[id]','id'],['negotiations/([^/]+)','negotiations/[id]','id'],['properties/search/?','properties/search'],['properties/tenant/?','properties/tenant'],['properties/([^/]+)','properties/[id]','id'],['users/search','users/search'],['users/([^/]+)','users/[id]','id'],['documents/property/([^/]+)','documents/property/[propertyId]','propertyId'],['documents/([^/]+)','documents/[id]','id'],['inspection-reports/property/([^/]+)','inspection-reports/property/[propertyId]','propertyId'],['inspection-reports/user/([^/]+)','inspection-reports/user/[userId]','userId'],['visits/([^/]+)','visits/[id]','id'],['admin/notifications/([^/]+)/read','admin/notifications/[id]/read','id'],['admin/notifications/([^/]+)/remarks','admin/notifications/[id]/remarks','id']];
  let name=pathname,params={};
  for(const [pattern,target,key]of matchers){const match=new RegExp('^'+pattern+'$').exec(pathname);if(match){name=target;if(key)params[key]=match[1];break;}}
  const handler=route(app,name)[req.method];if(!handler){res.writeHead(405);res.end();return;}
  const request=new Request('http://local'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await handler(request,{params:Promise.resolve(params)});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({success:false,message:'Acceptance adapter failed'}));}
}).listen(18081,'127.0.0.1',()=>console.log('Isolated acceptance API ready'));
