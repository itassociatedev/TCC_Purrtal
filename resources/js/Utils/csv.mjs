export function validCsvDate(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const date=new Date(value+'T00:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function parseCsv(text) {
 if(text.length>2_000_000)throw new Error('Use a CSV file smaller than 2 MB.');
 const rows=[];let row=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted){quoted=false;}else if(!cell){quoted=true;}else throw new Error('Invalid CSV quotes.');}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw new Error('A CSV quoted value was not closed.');
 row.push(cell);if(row.some(value=>value.trim()))rows.push(row);
 if(rows.length<2)throw new Error('Include a header and at least one data row.');
 if(rows.length>501)throw new Error('Import at most 500 rows at a time.');
 const headings=rows.shift().map(value=>value.trim().toLowerCase().replace(/\s+/g,'_'));
 if(new Set(headings).size!==headings.length||headings.some(value=>!value))throw new Error('CSV headings must be unique and non-empty.');
 return rows.map((values,index)=>{if(values.length!==headings.length)throw new Error(`Row ${index+2} has the wrong number of columns.`);return Object.fromEntries(headings.map((key,i)=>[key,values[i].trim()]));});
}
export function downloadCsv(name,columns,rows){
 const escape=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const content='\uFEFF'+[columns,...rows].map(row=>row.map(escape).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url);
}
