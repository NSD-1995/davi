export function distributePeriods(capacity:number,weights:number[]):number[]{
 if(capacity<weights.length)throw new Error('There are '+weights.length+' subjects but only '+capacity+' weekly teaching slots. Increase teaching time or reduce subjects.');
 const remaining=capacity-weights.length,total=weights.reduce((n,w)=>n+Math.max(1,w),0);
 const targets=weights.map(w=>remaining*Math.max(1,w)/total),counts=targets.map(n=>1+Math.floor(n));
 const order=targets.map((n,i)=>({i,fraction:n-Math.floor(n)})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 let extra=capacity-counts.reduce((n,v)=>n+v,0);for(const item of order){if(!extra)break;counts[item.i]++;extra--;}
 return counts;
}
