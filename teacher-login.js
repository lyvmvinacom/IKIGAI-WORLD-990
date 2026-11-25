(()=>{'use strict';
 const domain='@accounts.ikigai.invalid';
 function email(value){const id=String(value??'').trim();return !id.includes('@')&&/^[a-z][a-z0-9._-]{2,63}$/i.test(id)?id.toLowerCase()+domain:id}
 function displayName(user){const address=String(user?.email||'').toLowerCase();return address.endsWith(domain)?address.slice(0,-domain.length):'リー先生'}
 window.IKIGAI_TEACHER_LOGIN=Object.freeze({email,displayName});
})();
