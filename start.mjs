import {spawn} from 'node:child_process';
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
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,stdio:'ignore',windowsHide:true});
  child.on('error',error=>console.error(error.message));child.unref();
  for(let attempt=0;attempt<40;attempt++){
   await new Promise(resolve=>setTimeout(resolve,150));
   if(await probe()==='ours'){ready=true;break;}
  }
 }
 if(ready)console.log(`Student: ${url}/\nPrompts: ${url}/lesson.html\nTeacher: ${url}/teacher/\nRefresh after each prompt. No npm install is needed.`);
 else{console.error('Server did not start. Run node server.mjs to see the error.');process.exitCode=1;}
}
