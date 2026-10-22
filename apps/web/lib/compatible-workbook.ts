/** Excel producers may prefix SpreadsheetML elements; ExcelJS expects local names. */
export async function compatibleWorkbook(buffer:any){
 const mod=await import('jszip');const JSZip=mod.default || mod;const zip=await JSZip.loadAsync(buffer);let changed=false;
 if(!zip.file('xl/workbook.xml'))throw new Error('Workbook metadata is missing. Open the file in Excel and save it as XLSX.');
 for(const entry of Object.values(zip.files))if(!entry.dir&&/^xl\/.*\.xml$/.test(entry.name)){
  const xml=await entry.async('string');const prefixes=[...xml.matchAll(/xmlns:([\w]+)=["']http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main["']/g)].map(m=>m[1]);
  let updated=xml;for(const prefix of prefixes)updated=updated.replace(new RegExp('(<\\/?)(?:'+prefix+'):', 'g'),'$1');
  if(updated!==xml){zip.file(entry.name,updated);changed=true;}
 }
 // Import cell values, not Excel table definitions. ExcelJS assumes table part
 // paths follow its own naming convention; other producers can trigger an
 // undefined table.name during load. Removing this metadata preserves cells,
 // shared strings, date styles and formulas for the normal validation path.
 for(const entry of Object.values(zip.files))if(!entry.dir&&/^xl\/worksheets\/[^/]+\.xml$/.test(entry.name)){
  const xml=await entry.async('string');const updated=xml.replace(/<(?:[\w]+:)?tableParts\b[^>]*(?:\/\s*>|>[\s\S]*?<\/(?:[\w]+:)?tableParts\s*>)/g,'');
  if(updated!==xml){zip.file(entry.name,updated);changed=true;}
 }
 // Comments and legacy note drawings are not student cells. Some XLSX producers
 // store them at paths ExcelJS cannot resolve; omit annotation links in this
 // in-memory parsing copy while retaining the original uploaded document.
 for(const entry of Object.values(zip.files))if(!entry.dir&&/^xl\/worksheets\/_rels\/.*\.rels$/.test(entry.name)){
  const xml=await entry.async('string');const updated=xml.replace(/<(?:[\w]+:)?Relationship\b[^>]*\bType=["'][^"']*\/(?:comments|vmlDrawing|threadedComment)["'][^>]*\/\s*>/g,'');
  if(updated!==xml){zip.file(entry.name,updated);changed=true;}
 }
 return changed?await zip.generateAsync({type:'uint8array'}):buffer;
}
