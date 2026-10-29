export interface FileSessionUser {uid:string;emailVerified:boolean;getIdToken:(refresh?:boolean)=>Promise<string>}
export type FileSessionFailure='network'|'unauthenticated'|'forbidden'|'configuration'|'cookies'|'server';
export type FileSessionState={phase:'idle'|'preparing'|'retrying'|'ready'|'profile_required'|'failed';uid:string|null;message:string;failure?:FileSessionFailure;revision:number;readyRevision?:number};
export const INITIAL_FILE_SESSION:FileSessionState={phase:'idle',uid:null,message:'',revision:0};
type Dependencies={ready:()=>Promise<void>;currentUser:()=>FileSessionUser|null;request:(method:'POST'|'GET'|'DELETE',token:string|undefined,signal:AbortSignal)=>Promise<Response>;wait?:(ms:number,signal:AbortSignal)=>Promise<void>;now?:()=>number;timeoutMs?:number};
class SessionFailure extends Error {constructor(public kind:FileSessionFailure,public retryable=false,public profileRequired=false){super(kind);}}
const messages:Record<FileSessionFailure,string>={network:'Secure file access is temporarily unavailable. Please try again.',unauthenticated:'Sign in again to prepare secure file access.',forbidden:"You don't have permission to access these files.",configuration:'Secure file access is unavailable. Please contact support.',cookies:'Allow cookies for this site, then retry secure file access.',server:'Secure file access is unavailable. Please contact support.'};
function delay(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new Error('Cancelled'));return;}const finish=()=>{signal.removeEventListener('abort',cancel);resolve();};const timer=setTimeout(finish,ms);function cancel(){clearTimeout(timer);reject(new Error('Cancelled'));}signal.addEventListener('abort',cancel,{once:true});});}

/** One instance per browser app, including across Strict Mode effect remounts.
 * Cookie mutations are serialized across identities. Tokens are obtained from
 * the captured user and never substituted from a later auth.currentUser.
 */
export function createPrivateFileSession(deps:Dependencies){
  const now=deps.now||Date.now,wait=deps.wait||delay,listeners=new Set<(state:FileSessionState)=>void>();
  let state={...INITIAL_FILE_SESSION},desired:FileSessionUser|null|undefined,generation=0,revision=0,lastReady=0,lastRun=0;
  let tail=Promise.resolve(),active:{generation:number;promise:Promise<void>}|undefined,clearNeeded=true,waitController=new AbortController();
  const current=(version:number,uid:string|null)=>version===generation&&(deps.currentUser()?.emailVerified?deps.currentUser()?.uid:null)===uid;
  const publish=(patch:Omit<FileSessionState,'revision'>)=>{const next=++revision;state={...patch,revision:next,readyRevision:patch.phase==='ready'?next:state.readyRevision||0};listeners.forEach(listener=>listener(state));};
  async function request(method:'POST'|'GET'|'DELETE',token?:string){
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([deps.request(method,token,abort.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(new SessionFailure('network',true));},deps.timeoutMs??12000);})]);}
    catch(error){if(error instanceof SessionFailure)throw error;throw new SessionFailure('network',true);}
    finally{if(timer)clearTimeout(timer);}
  }
  async function check(response:Response){
    if(response.ok)return;
    let code='';try{const body=await response.json();code=typeof body.code==='string'?body.code:'';}catch{/* Ignore raw error text. */}
    if(code==='ACCOUNT_PROFILE_REQUIRED')throw new SessionFailure('forbidden',false,true);
    if(code==='FILE_SESSION_CONFIGURATION')throw new SessionFailure('configuration');
    if(code==='FILE_SESSION_COOKIE_MISSING')throw new SessionFailure('cookies');
    if(response.status===401)throw new SessionFailure('unauthenticated');
    if(response.status===403)throw new SessionFailure('forbidden');
    if([429,502,503,504].includes(response.status))throw new SessionFailure('network',true);
    throw new SessionFailure('server');
  }
  async function token(user:FileSessionUser,refresh:boolean){
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([user.getIdToken(refresh),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new SessionFailure('network',true)),deps.timeoutMs??12000);})]);}
    catch(error){if(error instanceof SessionFailure)throw error;const code=(error as {code?:string}).code;if(code==='auth/network-request-failed')throw new SessionFailure('network',true);throw new SessionFailure('unauthenticated');}
    finally{if(timer)clearTimeout(timer);}
  }
  function start(user:FileSessionUser|null){
    const version=generation,uid=user?.uid||null;
    if(active?.generation===version)return active.promise;
    if(user)publish({phase:'preparing',uid,message:'Preparing secure file access...'});
    const promise=tail.catch(()=>{}).then(async()=>{
      await deps.ready();if(!current(version,uid))return;
      let refreshed=false;lastRun=now();
      for(let attempt=0;attempt<3;attempt++){
        if(!current(version,uid))return;
        try{
          if(clearNeeded){await check(await request('DELETE'));if(!current(version,uid))return;clearNeeded=false;}
          if(!user)return;
          let bearer=await token(user,false);
          for(;;){
            if(!current(version,uid))return;
            try{
              await check(await request('POST',bearer));
              if(!current(version,uid))return;
              // Confirm the browser retained the HttpOnly cookie and it belongs
              // to this Firebase UID, not a previous account or another tab.
              await check(await request('GET',bearer));break;
            }catch(error){if(error instanceof SessionFailure&&error.kind==='unauthenticated'&&!refreshed){refreshed=true;bearer=await token(user,true);continue;}throw error;}
          }
          if(current(version,uid)){lastReady=now();publish({phase:'ready',uid,message:''});}return;
        }catch(error){
          if(!current(version,uid))return;
          const failure=error instanceof SessionFailure?error:new SessionFailure('network',true);
          if(failure.retryable&&attempt<2){
            if(user)publish({phase:'retrying',uid,message:'Secure file access is temporarily unavailable. Retrying...'});
            try{await wait(500*2**attempt,waitController.signal);}catch{return;}
            continue;
          }
          if(user)publish(failure.profileRequired?{phase:'profile_required',uid,message:'Complete your account profile before opening private files.'}:{phase:'failed',uid,failure:failure.kind,message:messages[failure.kind]});
          return;
        }
      }
    }).catch(()=>{if(user&&current(version,uid))publish({phase:'failed',uid,failure:'network',message:messages.network});});
    active={generation:version,promise};tail=promise;
    void promise.finally(()=>{if(active?.promise===promise)active=undefined;});return promise;
  }
  return {
    snapshot:()=>state,
    subscribe(listener:(state:FileSessionState)=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
    setUser(user:FileSessionUser|null){
      const next=user?.emailVerified?user:null,changed=desired===undefined||desired?.uid!==next?.uid;
      desired=next;
      if(changed){generation++;clearNeeded=true;waitController.abort();waitController=new AbortController();lastReady=0;publish({phase:next?'preparing':'idle',uid:next?.uid||null,message:next?'Preparing secure file access...':''});}
      if(active?.generation===generation)return active.promise;
      if(!changed&&(state.phase==='failed'||state.phase==='idle'||state.phase==='ready'&&now()-lastReady<10*60000))return Promise.resolve();
      return start(next);
    },
    retry(){return desired?start(desired):Promise.resolve();},
    renew(){
      if(desired===undefined)return Promise.resolve();
      if(!desired)return clearNeeded&&now()-lastRun>=30000?start(null):Promise.resolve();
      if(state.phase==='profile_required'||state.phase==='failed')return Promise.resolve();
      if(now()-lastRun<30000||state.phase==='ready'&&now()-lastReady<10*60000)return Promise.resolve();
      return start(desired);
    },
  };
}
