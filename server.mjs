import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4195);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PORT');
const project=createHash('sha256').update(fs.realpathSync(root)).digest('hex').slice(0,16);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
 if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({app:'peak-jump-classroom',project}));return;}
 if(['/teacher','/teacher/','/lesson.html'].includes(pathname)){res.writeHead(302,{Location:'/'});res.end();return;}
 if(pathname.split(/[\\/]/).some(part=>part.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
 if(pathname.endsWith('/'))pathname+='index.html';
 const filename=path.resolve(root,'.'+pathname);
 if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
 fs.stat(filename,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(filename).on('error',()=>res.destroy()).pipe(res);
 });
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Close that server or use another PORT.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Game: http://127.0.0.1:${port}/`));
