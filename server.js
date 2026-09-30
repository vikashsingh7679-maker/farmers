const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');

const root = __dirname;
const dataFile = path.join(root, 'data', 'clinic.json');
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml' };
const sessions = new Map();
function store(){return JSON.parse(fs.readFileSync(dataFile,'utf8'));}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let body='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size>1_000_000){reject(new Error('Request too large.'));req.destroy();return;}body+=chunk;});req.on('end',()=>{try{resolve(JSON.parse(body));}catch{reject(new Error('Could not read request.'));}});req.on('error',reject);});}
function doctorFor(req){const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');return sessions.get(token);}
function safeEqual(left,right){const a=Buffer.from(String(left)),b=Buffer.from(String(right));return a.length===b.length&&timingSafeEqual(a,b);}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='POST'&&url.pathname==='/api/login'){
    try{const body=await readBody(req),db=store(),doctor=db.doctors.find(d=>d.email.toLowerCase()===String(body.email||'').trim().toLowerCase());
      if(!doctor||!safeEqual(body.password||'',doctor.password))return json(res,401,{error:'Email or password is incorrect.'});
      const token=randomBytes(32).toString('hex');sessions.set(token,{id:doctor.id,name:doctor.name,role:doctor.role,clinicId:doctor.clinicId});return json(res,200,{token,doctor:{name:doctor.name,role:doctor.role}});
    }catch{return json(res,400,{error:'Could not read sign-in details.'});}
  }
  if(url.pathname.startsWith('/api/')){
    const doctor=doctorFor(req);if(!doctor)return json(res,401,{error:'Session expired. Please sign in again.'});
    const db=store();if(doctor.clinicId!==db.clinic.id)return json(res,403,{error:'This account is outside the clinic.'});
    if(req.method==='GET'&&url.pathname==='/api/session')return json(res,200,{doctor:{name:doctor.name,role:doctor.role}});
    if(req.method==='GET'&&url.pathname==='/api/patients')return json(res,200,{patients:db.patients.map(({id,name,age,sex,lastVisit,report,rgbProfile,matchThreshold})=>({id,name,age,sex,lastVisit,report,rgbProfile,matchThreshold}))});
    return json(res,404,{error:'API route not found.'});
  }
  const requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),target=path.resolve(root,'.'+requested);
  if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(target,(err,file)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(file);});
});
const port=process.env.PORT||3000;server.listen(port,()=>console.log(`Aster Eye Institute portal is ready at http://localhost:${port}`));
