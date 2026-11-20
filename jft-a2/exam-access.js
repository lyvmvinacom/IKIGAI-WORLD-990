// Entry controls are server-authoritative. These helpers only present catalog state.
export const entryClosed=(test,canManage=false)=>!canManage&&test?.access?.controlled===true&&test.access.open!==true;
export function mergeCatalog(current,incoming){
 if(!Array.isArray(incoming))throw new Error('Danh sách đề không hợp lệ.');
 let changed=false;
 for(const test of incoming){
  const existing=current.find(item=>item.id===test.id);
  if(existing){if(('access' in test&&JSON.stringify(existing.access)!==JSON.stringify(test.access))||['title','source','metadataRevision'].some(key=>key in test&&existing[key]!==test[key]))changed=true;Object.assign(existing,test);}
  else{current.push(test);changed=true;}
 }
 return changed;
}

