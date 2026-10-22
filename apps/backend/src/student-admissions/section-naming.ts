export type SectionNaming = 'AUTO' | 'NUMERIC' | 'ALPHABETIC';
export function sectionName(index:number, sections:{name:string;status?:string}[], style:SectionNaming='AUTO') {
 const active=sections.filter(s=>!s.status || s.status==='ACTIVE');
 const numeric=active.filter(s=>/^[1-9]\d*$/.test(s.name.trim())).length;
 const alphabetic=active.filter(s=>/^[a-z]+$/i.test(s.name.trim())).length;
 if(style==='NUMERIC' || (style==='AUTO' && numeric>alphabetic))return String(index+1);
 let value=index+1,name='';while(value){value--;name=String.fromCharCode(65+value%26)+name;value=Math.floor(value/26);}return name;
}
