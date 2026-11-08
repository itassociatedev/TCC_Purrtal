import {useState} from 'react';
import axios from 'axios';

export default function CsvImportControl({columns,sample,onImport,label='Import XLSX',disabled=false,description=''}){
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const chooseFile=async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
   setError('');
   if(file.size>2_000_000)throw new Error('Choose an XLSX file smaller than 2 MB.');
   if(!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('Choose an XLSX workbook.');
   const data=new FormData();data.append('file',file);
   const response=await axios.post('/spreadsheet-import/read',data);
   setRows(response.data.rows);
  }catch(error){setRows(null);setError(error.response?.data?.message||error.message);}
 };
 const downloadTemplate=async()=>{
  try{
   setError('');
   const response=await axios.post('/spreadsheet-import/template',{columns,sample:sample.map(value=>String(value??''))},{responseType:'blob'});
   const url=URL.createObjectURL(response.data),link=document.createElement('a');
   link.href=url;link.download='import-template.xlsx';link.click();URL.revokeObjectURL(url);
  }catch{setError('Unable to download the XLSX template. Please try again.');}
 };
 const confirmImport=async()=>{
  try{setBusy(true);setError('');await onImport(rows);setRows(null);}
  catch(error){setError(error.response?.data?.message||error.message);}
  finally{setBusy(false);}
 };
 return <section className="csv-import-control" aria-label={label}>
  <header className="csv-import-heading"><strong>{label}</strong><span>XLSX · Up to 500 rows · 2 MB max</span></header>
  {description&&<p className="csv-import-description">{description}</p>}
  <div className="csv-import-toolbar">
   <label className="csv-import-choose">Choose XLSX file<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={disabled||busy} onChange={chooseFile}/></label>
   <button type="button" className="csv-import-template" disabled={disabled||busy} onClick={downloadTemplate}>Download template</button>
  </div>
  {rows&&<div className="csv-import-ready"><span>{rows.length} {rows.length===1?'row':'rows'} ready to import</span><div><button type="button" disabled={busy||disabled} onClick={confirmImport}>{busy?'Importing…':'Import records'}</button><button type="button" onClick={()=>setRows(null)}>Cancel</button></div></div>}
  {error&&<p role="alert" className="csv-import-error">{error}</p>}
 </section>;
}
