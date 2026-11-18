const pick=a=>a[Math.floor(Math.random()*a.length)];
const norm=s=>s.normalize('NFKC').replace(/[\s。、！？!?]/g,'');
const objects=[['📕','本','ほん'],['🎒','かばん','鞄'],['✏️','鉛筆','えんぴつ'],['☂️','傘','かさ'],['⌚','時計','とけい'],['🔑','鍵','かぎ'],['📱','携帯電話','けいたいでんわ'],['👟','靴','くつ'],['🖊️','ペン'],['📓','ノート'],['🪑','椅子','いす']];
const kana=['','いち','に','さん','よん','ご','ろく','なな','はち','きゅう','じゅう','じゅういち','じゅうに'];
const kanji=['','一','二','三','四','五','六','七','八','九','十','十一','十二'];
const nums=n=>[String(n),kana[n],kanji[n],...(n===4?['よ']:n===7?['しち']:n===9?['く']:[])].filter(Boolean);
function clock(h,m){const hand=(a,l,w)=>'<line x1="60" y1="60" x2="'+(60+l*Math.sin(a))+'" y2="'+(60-l*Math.cos(a))+'" stroke="#17334a" stroke-width="'+w+'" stroke-linecap="round"/>';return '<svg viewBox="0 0 120 120" width="132" height="132" aria-label="Đồng hồ kim"><circle cx="60" cy="60" r="56" fill="white" stroke="#17334a" stroke-width="3"/>'+Array.from({length:12},(_,i)=>{const n=i+1,a=n*Math.PI/6;return '<text x="'+(60+44*Math.sin(a))+'" y="'+(64-44*Math.cos(a))+'" text-anchor="middle" font-size="11" fill="#17334a">'+n+'</text>'}).join('')+hand((h+m/60)*Math.PI/6,27,5)+hand(m*Math.PI/30,39,3)+'<circle cx="60" cy="60" r="3" fill="#17334a"/></svg>'}
const icon=x=>'<span style="font-size:76px;line-height:1.25" aria-hidden="true">'+x+'</span>';
const exact=(a,words)=>words.some(w=>[w,w+'です',w+'だ'].includes(norm(a)));
export function visualFor(q){
 if(/それは なんですか/.test(q)){const [im,...words]=pick(objects);return {html:icon(im),question:'これは なんですか',check:a=>exact(a,words)}}
 if(/いま なんじですか/.test(q)){const h=pick([1,2,3,4,5,6,7,8,9,10,11,12]),m=pick([0,15,30,45]);const mins=m===0?['','0分','れいふん']:m===15?['15分','十五分','じゅうごふん']:m===30?['30分','三十分','さんじゅっぷん','さんじっぷん','半','はん']:['45分','四十五分','よんじゅうごふん'];const words=nums(h).flatMap(n=>['時','じ'].flatMap(j=>mins.map(k=>n+j+k)));return {html:clock(h,m),question:q,check:a=>exact(a,words)}}
 if(/くつは いくら/.test(q)){const n=pick([100,200,300,500,1000,2000,3000]);const names={100:['百','ひゃく'],200:['二百','にひゃく'],300:['三百','さんびゃく'],500:['五百','ごひゃく'],1000:['千','せん'],2000:['二千','にせん'],3000:['三千','さんぜん']};return {html:icon('👟')+'<strong style="font-size:25px;color:#17334a">¥'+n+'</strong>',question:q,check:a=>exact(a,[String(n),...names[n]].flatMap(x=>[x+'円',x+'えん']))}}
 if(/それは だれの/.test(q)){const [im]=pick(objects);const name=pick(['田中','山田','佐藤']);const reading={田中:'たなか',山田:'やまだ',佐藤:'さとう'}[name];return {html:icon(im)+'<strong style="color:#17334a;font-size:22px">'+name+'</strong>',question:'これは だれのですか',check:a=>exact(a,[name,reading].flatMap(x=>[x+'さんの',x+'の']))}}
 if(/それは なんの ほん/.test(q)){const [im,...words]=pick([['🚗','車','くるま'],['🐱','猫','ねこ'],['✈️','飛行機','ひこうき']]);return {html:'<div style="border:3px solid #17334a;border-radius:5px;padding:8px;background:#e1f0fa">'+icon(im)+'</div>',question:'これは なんの ほんですか',check:a=>exact(a,words.flatMap(x=>[x+'の本',x+'のほん']))}}
 return null
}
