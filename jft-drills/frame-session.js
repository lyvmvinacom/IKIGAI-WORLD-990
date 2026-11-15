// Same-origin iframe startup with an explicit ready/ack handshake. Some mobile
// browsers finish the initial frame load before its game listener is installed.
export function connectGameFrame({frame,session,prefix,payload,onMessage,onFailure,timeoutMs=15000,retryMs=400,environment=window}){
 let disposed=false,started=false,acknowledged=false,failed=false,retryTimer=null,timeoutTimer=null;
 const origin=environment.location.origin;
 function clear(){environment.clearInterval(retryTimer);environment.clearTimeout(timeoutTimer);retryTimer=timeoutTimer=null;}
 function send(type){if(disposed)return;try{frame.contentWindow?.postMessage({type,session,...payload},origin);}catch(error){fail(error.message||'Không gửi được dữ liệu trò chơi.');}}
 function fail(message){if(disposed||failed||acknowledged)return;failed=true;clear();onFailure?.(message);}
 function start(){if(disposed||acknowledged||failed)return;if(!started){started=true;retryTimer=environment.setInterval(()=>send(prefix+'-init'),retryMs);timeoutTimer=environment.setTimeout(()=>fail('Trò chơi chưa xác nhận nhận được dữ liệu. Hãy tải lại trò chơi.'),timeoutMs);}send(prefix+'-init');}
 function receive(event){const d=event.data;if(disposed||event.origin!==origin||event.source!==frame.contentWindow||d?.session!==session)return;
  if(d.type===prefix+'-ready'){start();return;}
  if(d.type===prefix+'-ack'){if(failed)return;acknowledged=true;clear();return;}
  if(d.type===prefix+'-error'){fail(String(d.message||'Không khởi động được trò chơi.'));return;}
  onMessage?.(event);
 }
 environment.addEventListener('message',receive);
 return {start,send,fail,restart(){if(disposed)return;clear();started=acknowledged=failed=false;start();},dispose(){if(disposed)return;send(prefix+'-stop');disposed=true;clear();environment.removeEventListener('message',receive);}};
}

export function showGameFrameFailure({host,message,onRetry,onMenu,onClose}){
 const panel=document.createElement('section');panel.className='jft-frame-error';
 panel.style.cssText='position:absolute;inset:0;z-index:2;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;padding:20px;overflow:auto;background:#102b36;color:#eff9f9;font:16px/1.6 system-ui;text-align:center';
 const title=document.createElement('h2');title.textContent='Chưa tải được trò chơi';title.style.margin='0';
 const detail=document.createElement('p');detail.textContent=message;detail.setAttribute('role','status');detail.style.margin='0';
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
 for(const [label,action]of [['Tải lại trò chơi',()=>{panel.remove();onRetry();}],['← Danh sách đề',onMenu],['Đóng',onClose]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='font:inherit;min-height:44px;padding:8px 14px;border:1px solid #82cbb9;border-radius:8px;background:#193b49;color:#eff9f9;cursor:pointer';b.onclick=action;actions.append(b);}
 panel.append(title,detail,actions);host.append(panel);return panel;
}
