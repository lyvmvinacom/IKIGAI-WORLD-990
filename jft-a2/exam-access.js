// Entry controls are server-authoritative. These helpers only present catalog state.
export const entryClosed=(test,canManage=false)=>!canManage&&test?.access?.controlled===true&&test.access.open!==true;
export function mergeCatalog(current,incoming){
 if(!Array.isArray(incoming))throw new Error('Danh sách đề không hợp lệ.');
 let changed=false;
 for(const test of incoming){
  const existing=current.find(item=>item.id===test.id);
  if(existing){if(JSON.stringify(existing.access)!==JSON.stringify(test.access))changed=true;Object.assign(existing,test);}
  else{current.push(test);changed=true;}
 }
 return changed;
}
