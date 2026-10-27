import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import { resolve } from 'path';
export interface MediaStorageProvider { readonly name:string; put(key:string,data:Buffer):Promise<void>; get(key:string):Promise<Buffer>; remove(key:string):Promise<void>; }
@Injectable()
export class LocalMediaStorage implements MediaStorageProvider {
 readonly name='local';
 private root=resolve(process.env.MEDIA_STORAGE_DIR||'./private-media');
 private path(key:string){if(!/^[a-f0-9-]{36}\.png$/.test(key))throw new Error('Invalid media storage key');return resolve(this.root,key);}
 async put(key:string,data:Buffer){await mkdir(this.root,{recursive:true});await writeFile(this.path(key),data,{flag:'wx',mode:0o600});}
 async get(key:string){return readFile(this.path(key));}
 async remove(key:string){await unlink(this.path(key)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
@Injectable()
export class MediaStorage {
 constructor(private local:LocalMediaStorage){}
 provider(name=process.env.MEDIA_STORAGE_PROVIDER||'local'):MediaStorageProvider {if(name==='local')return this.local;throw new ServiceUnavailableException('This media provider is not configured. Use local storage or configure a tested object-storage adapter.');}
}
