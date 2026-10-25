import {openingWarningLabels} from './openingRounds.mjs';

export default function OpeningWarning({task}) {
 const labels=openingWarningLabels(task);
 if(!labels.length)return null;
 const text=`${labels.length} system warning${labels.length===1?'':'s'}: ${labels.join(', ')}`;
 return <span className="tm-opening-warning" role="img" aria-label={text} title={text}><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg><span aria-hidden="true">{labels.length} {labels.length===1?'warning':'warnings'}</span></span>;
}
