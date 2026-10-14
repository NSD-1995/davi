import type {Context,Entry,Slot} from './constraint-engine';

// Shared period boundaries allow each period's teachers to be matched together.
// Swapping subjects within a section preserves its exact weekly requirements.
export function synchronizedTemplateSearch(c:Context,maxSteps:number):{entries:Entry[];attempts:number}|undefined{
 const slots=c.slots.filter(s=>s.type==='TEACHING'||s.type==='SUBJECT');
 if(c.fixed.length||slots.some(a=>slots.some(b=>a.weekday===b.weekday&&a.startTime<b.endTime&&b.startTime<a.endTime&&(a.startTime!==b.startTime||a.endTime!==b.endTime))))return;
 const cells:{slot:Slot;requirement:number;wave:number}[]=[],waves:number[][]=[],sections:number[][]=[];
 const waveIds=new Map<string,number>();
 for(const sectionId of new Set(slots.map(s=>s.sectionId))){const section:number[]=[];
  const lessons=c.requirements.flatMap((r,i)=>r.sectionId===sectionId?Array(r.weeklyPeriods).fill(i):[]);
  const sectionSlots=slots.filter(s=>s.sectionId===sectionId).sort((a,b)=>a.weekday-b.weekday||a.sequence-b.sequence);
  if(lessons.length!==sectionSlots.length)return;
  sectionSlots.forEach((slot,i)=>{const key=slot.weekday+':'+slot.startTime+':'+slot.endTime;let wave=waveIds.get(key);if(wave==null){wave=waves.length;waveIds.set(key,wave);waves.push([]);}const index=cells.length;cells.push({slot,requirement:lessons[i],wave});waves[wave].push(index);section.push(index);});sections.push(section);
 }
 let seed=13579,attempts=0;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 const candidates=cells.map(cell=>c.requirements.map(r=>r.teacherIds.filter(id=>!c.external.some(e=>e.teacherId===id&&e.weekday===cell.slot.weekday&&e.startTime<cell.slot.endTime&&cell.slot.startTime<e.endTime))));
 const matchWave=(wave:number,output?:Entry[])=>{
  const matched=new Map<string,number>();
  const match=(index:number,seen:Set<string>):boolean=>{for(const id of candidates[index][cells[index].requirement]){if(seen.has(id))continue;seen.add(id);if(!matched.has(id)||match(matched.get(id)!,seen)){matched.set(id,index);return true;}}return false;};
  let count=0;for(const index of waves[wave])if(match(index,new Set()))count++;
  if(output)for(const [teacherId,index] of matched){const cell=cells[index],r=c.requirements[cell.requirement];output.push({teacherId,subjectId:r.subjectId,sectionId:r.sectionId,classId:r.classId,weekday:cell.slot.weekday,periodSlotId:cell.slot.id});}
  return (waves[wave].length-count)*10;
 };
 const dailyCost=(section:number)=>{const counts=new Map<string,number>();let cost=0;for(const index of sections[section]){const cell=cells[index],key=cell.requirement+':'+cell.slot.weekday;counts.set(key,(counts.get(key)||0)+1);if(counts.get(key)!>c.requirements[cell.requirement].maxPeriodsPerDay)cost+=4;}return cost;};
 const initial=cells.map(cell=>cell.requirement);
 while(attempts<maxSteps){
  // A different deterministic shuffle prevents a stalled arrangement repeating.
  cells.forEach((cell,i)=>cell.requirement=initial[i]);
  for(const section of sections)for(let i=section.length-1;i>0;i--){const j=Math.floor(random()*(i+1)),a=cells[section[i]],b=cells[section[j]];[a.requirement,b.requirement]=[b.requirement,a.requirement];}
  const waveCosts=waves.map((_,i)=>matchWave(i)),dailyCosts=sections.map((_,i)=>dailyCost(i));
  let cost=waveCosts.reduce((a,b)=>a+b,0)+dailyCosts.reduce((a,b)=>a+b,0);
  for(let step=0;step<5000&&attempts<maxSteps;step++,attempts++){
   if(cost===0){const entries:Entry[]=[];waves.forEach((_,i)=>matchWave(i,entries));return{entries,attempts};}
   const bad=waves.map((_,i)=>i).filter(i=>waveCosts[i]>0);
   let section:number;
   if(bad.length&&random()<0.8){const wave=waves[bad[Math.floor(random()*bad.length)]];const index=wave[Math.floor(random()*wave.length)];section=sections.findIndex(s=>s.includes(index));}
   else section=Math.floor(random()*sections.length);
   const indices=sections[section],a=indices[Math.floor(random()*indices.length)],b=indices[Math.floor(random()*indices.length)];
   if(a===b||cells[a].requirement===cells[b].requirement)continue;
   const affected=[...new Set([cells[a].wave,cells[b].wave])],before=dailyCosts[section]+affected.reduce((n,i)=>n+waveCosts[i],0);
   [cells[a].requirement,cells[b].requirement]=[cells[b].requirement,cells[a].requirement];
   const nextWaves=affected.map(i=>matchWave(i)),nextDaily=dailyCost(section),after=nextDaily+nextWaves.reduce((a,b)=>a+b,0),delta=after-before;
   const temperature=0.3+3*(1-step/5000);
   if(delta<=0||random()<Math.exp(-delta/temperature)){cost+=delta;dailyCosts[section]=nextDaily;affected.forEach((i,j)=>waveCosts[i]=nextWaves[j]);}
   else [cells[a].requirement,cells[b].requirement]=[cells[b].requirement,cells[a].requirement];
  }
 }
 return{entries:[],attempts};
}
