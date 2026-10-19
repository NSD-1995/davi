import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createConnection } from 'net';
@Injectable()
export class MigrationScanner {
 async scan(buffer:Buffer):Promise<{clean:boolean;message:string}>{
  const host=process.env.MIGRATION_CLAMD_HOST;
  if(!host)throw new ServiceUnavailableException('Malware scanner is not configured. Files remain quarantined. Configure MIGRATION_CLAMD_HOST and retry extraction.');
  return new Promise((resolve,reject)=>{
   const socket=createConnection({host,port:Number(process.env.MIGRATION_CLAMD_PORT || 3310)});let response='';
   const timer=setTimeout(()=>socket.destroy(new Error('Malware scanner timed out.')),30000);
   socket.on('connect',()=>{socket.write('zINSTREAM\0');for(let offset=0;offset<buffer.length;offset+=65536){const chunk=buffer.subarray(offset,offset+65536),length=Buffer.alloc(4);length.writeUInt32BE(chunk.length);socket.write(length);socket.write(chunk);}socket.write(Buffer.alloc(4));});
   socket.on('data',chunk=>{response+=chunk.toString();if(response.length>4096)socket.destroy(new Error('Invalid scanner response.'));if(response.includes('\0')||response.includes('\n'))socket.end();});
   socket.on('error',e=>{clearTimeout(timer);reject(new ServiceUnavailableException('Malware scanner unavailable: '+e.message));});
   socket.on('close',()=>{clearTimeout(timer);if(/: OK\s*\0?$/.test(response))resolve({clean:true,message:'Clean (ClamAV)'});else if(response.includes('FOUND'))resolve({clean:false,message:'Malware detected; file remains quarantined.'});else reject(new ServiceUnavailableException('Scanner did not return a clean verdict. Retry when the scanner is available.'));});
  });
 }
}
