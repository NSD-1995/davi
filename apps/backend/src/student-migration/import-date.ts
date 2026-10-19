/** Import dates use day-first for numeric dates; two-digit years require review. */
export function normalizeImportDate(value:unknown):string {
 if(value==null||String(value).trim()==='')return '';
 if(value instanceof Date){if(!Number.isFinite(value.getTime()))throw new Error('Invalid date.');return value.toISOString().slice(0,10);}
 const input=String(value).trim();let year:number,month:number,day:number;
 if(/^\d{5}(?:\.\d+)?$/.test(input)){
  const serial=Number(input);if(serial<1||serial>100000||Math.floor(serial)===60)throw new Error('Invalid Excel date.');
  return new Date(Date.UTC(1899,11,31)+(Math.floor(serial)-(serial>60?1:0))*86400000).toISOString().slice(0,10);
 }
 let match=input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
 if(match){year=+match[1];month=+match[2];day=+match[3];}
 else {match=input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
 if(match){day=+match[1];month=+match[2];year=+match[3];if(month>12&&day<=12)[day,month]=[month,day];}
 else {const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const text=input.replace(/,/g,'').replace(/[-/]/g,' ').replace(/\s+/g,' ');match=text.match(/^(\d{1,2}) ([a-z]+) (\d{4})$/i);if(match){day=+match[1];month=months.indexOf(match[2].slice(0,3).toLowerCase())+1;year=+match[3];}else {match=text.match(/^([a-z]+) (\d{1,2}) (\d{4})$/i);if(!match)throw new Error('Unrecognized date. Use a four-digit year, e.g. 31/12/2018.');month=months.indexOf(match[1].slice(0,3).toLowerCase())+1;day=+match[2];year=+match[3];}}}
 const result=new Date(Date.UTC(year,month-1,day));if(year<1900||year>2100||result.getUTCFullYear()!==year||result.getUTCMonth()!==month-1||result.getUTCDate()!==day)throw new Error('Invalid calendar date.');return result.toISOString().slice(0,10);
}
