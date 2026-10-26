import { Injectable } from '@nestjs/common';
import { connect as tcp } from 'net';
import { connect as tls } from 'tls';
// Optional Redis cache. No student records are cached: only opaque snapshot IDs.
export function readResp(buffer:Buffer):{value:any;bytes:number}|null{
 const end=buffer.indexOf('\r\n');if(end<0)return null;const type=String.fromCharCode(buffer[0]),line=buffer.toString('utf8',1,end);
 if(type==='+'||type===':')return {value:type===':'?Number(line):line,bytes:end+2};
 if(type==='-')throw new Error('Redis rejected cache command');
 if(type==='$'){const n=Number(line);if(n===-1)return {value:null,bytes:end+2};if(!Number.isInteger(n)||n<0||n>4096)throw new Error('Invalid Redis reply');if(buffer.length<end+2+n+2)return null;return {value:buffer.toString('utf8',end+2,end+2+n),bytes:end+2+n+2};}throw new Error('Unexpected Redis reply');
}
@Injectable()
export class AnalyticsCache {
 async command(args:string[]):Promise<any>{
  if(!process.env.REDIS_URL)return null;
  return new Promise(resolve=>{let done=false;const finish=(v:any)=>{if(done)return;done=true;socket.destroy();resolve(v);};let socket:any;
   try{const u=new URL(process.env.REDIS_URL!);if(!['redis:','rediss:'].includes(u.protocol))return resolve(null);const commands:string[][]=[];if(u.password)commands.push(u.username?['AUTH',decodeURIComponent(u.username),decodeURIComponent(u.password)]:['AUTH',decodeURIComponent(u.password)]);if(u.pathname&&u.pathname!=='/')commands.push(['SELECT',u.pathname.slice(1)]);commands.push(args);
    const options={host:u.hostname,port:Number(u.port||6379),...(u.protocol==='rediss:'?{servername:u.hostname}:{})};socket=u.protocol==='rediss:'?tls(options):tcp(options);socket.setTimeout(800,()=>finish(null));socket.on('error',()=>finish(null));let buffer=Buffer.alloc(0),received=0;
    socket.on(u.protocol==='rediss:'?'secureConnect':'connect',()=>socket.write(commands.map(c=>'*'+c.length+'\r\n'+c.map(v=>'$'+Buffer.byteLength(v)+'\r\n'+v+'\r\n').join('')).join('')));
    socket.on('data',(data:Buffer)=>{try{buffer=Buffer.concat([buffer,data]);if(buffer.length>8192)return finish(null);while(buffer.length){const reply=readResp(buffer);if(!reply)return;buffer=buffer.subarray(reply.bytes);if(++received===commands.length)return finish(reply.value);}}catch{finish(null);}});socket.on('end',()=>finish(null));
   }catch{if(socket)finish(null);else resolve(null);}
  });
 }
 get(key:string){return this.command(['GET',key]);}
 set(key:string,value:string){return this.command(['SET',key,value,'EX','30']);}
}
