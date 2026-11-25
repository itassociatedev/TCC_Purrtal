export function normalizeSearch(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
export function matchesSearch(query,...fields){
 const tokens=normalizeSearch(query).split(/\s+/).filter(Boolean);
 const text=normalizeSearch(fields.flat(Infinity).filter(value=>value!=null).join(' '));
 return tokens.every(token=>text.includes(token));
}
