import { z } from 'zod';
export const eventAliases:Record<string,string[]>= {
 title:['title','name','eventname','holidayname','holiday','event'], startsAt:['startsat','startdate','date','eventdate','holidaydate','from'],
 endsAt:['endsat','enddate','to'], eventType:['eventtype','type'], description:['description','details'], location:['location','venue'], status:['status'],
};
export function eventMapping(headers:string[]){const result:Record<string,string>={};for(const h of headers){const key=h.toLowerCase().replace(/[^a-z0-9]/g,'');const target=Object.keys(eventAliases).find(k=>eventAliases[k].includes(key));if(target)result[h]=target;}return result;}
export const eventImportSchema=z.array(z.object({title:z.string().trim().min(1).max(200),description:z.string().max(2000).optional(),eventType:z.string().trim().min(1).max(100),startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true}).optional(),location:z.string().max(200).optional(),status:z.enum(['ACTIVE','CANCELLED']).default('ACTIVE')}).strict().refine(r=>!r.endsAt||new Date(r.endsAt)>=new Date(r.startsAt),'End date must be on or after start date.')).min(1).max(500);
