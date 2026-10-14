'use client';

export function printTimetables(sectionElementId?:string){
 const target=sectionElementId?document.getElementById(sectionElementId):null;
 document.body.classList.add('timetable-print');
 if(target){document.body.classList.add('timetable-print-one');target.classList.add('timetable-print-target');}
 const cleanup=()=>{document.body.classList.remove('timetable-print','timetable-print-one');target?.classList.remove('timetable-print-target');};
 window.addEventListener('afterprint',cleanup,{once:true});
 try{window.print();}catch(error){window.removeEventListener('afterprint',cleanup);cleanup();throw error;}
}
