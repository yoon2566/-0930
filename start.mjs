import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4195);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PORT');
const project=createHash('sha256').update(realpathSync(root)).digest('hex').slice(0,16);
const url=`http://127.0.0.1:${port}`;
async function probe(){
 try{
  const response=await fetch(url+'/health',{signal:AbortSignal.timeout(700)});
  const data=await response.json().catch(()=>({}));
  return data.app==='peak-jump-classroom'&&data.project===project?'ours':'other';
 }catch(error){return error.name==='TimeoutError'?'other':'absent';}
}
const state=await probe();
if(state==='other'){
 console.error(`Port ${port} is used by another project. Stop its server or choose another PORT.`);process.exitCode=1;
}else{
 let ready=state==='ours';
 if(!ready){
  if(process.platform==='win32'){
   // A new hidden console lets OpenCode's terminal close after this launcher exits.
   // A detached Node child alone can keep the Windows pseudo-console open.
   const quote=value=>"'"+value.replaceAll("'","''")+"'";
   const command=`$ErrorActionPreference='Stop'; Start-Process -FilePath ${quote(process.execPath)} -ArgumentList ${quote('"'+path.join(root,'server.mjs')+'"')} -WorkingDirectory ${quote(root)} -WindowStyle Hidden`;
   const launched=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{stdio:'ignore',windowsHide:true,timeout:10000});
   if(launched.error||launched.status!==0)throw new Error('Could not start the hidden game server. Run node server.mjs in a separate terminal.');
  }else{
   const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,stdio:'ignore'});
   child.on('error',error=>console.error(error.message));child.unref();
  }
  for(let attempt=0;attempt<40;attempt++){
   await new Promise(resolve=>setTimeout(resolve,150));
   if(await probe()==='ours'){ready=true;break;}
  }
 }
 if(ready)console.log(`Game: ${url}/\nThe local game server is running. Open this address in your browser. No npm install is needed.`);
 else{console.error('Server did not start. Run node server.mjs to see the error.');process.exitCode=1;}
}
