// Correct keys stay in the private database; media is signed for logged-in members.
export function createN4Adapter(client){
 const urls=new Map();
 async function prepare(exam){if(!exam)return;const paths=new Set([exam.audio,...(exam.listeningDirections||[])]);for(const s of exam.sections)for(const q of s.questions){if(q.image)paths.add(q.image);for(const p of q.context||[])paths.add(p)}for(const p of exam.solutions||[])paths.add(p.image);
 const list=[...paths].filter(Boolean);const {data,error}=await client.storage.from('ikigai-n4-media').createSignedUrls(list.map(p=>'n4/'+p),10800);if(error)throw error;for(let i=0;i<list.length;i++){const row=data[i];if(row.error||!row.signedUrl)throw Error('Chưa tải được hình / âm thanh N4.');urls.set(list[i],row.signedUrl)}}
 return createJlptAdapter(client,'n4',{media:p=>urls.get(p)||'',prepare});
}

export function createJlptAdapter(client, level, {media, prepare}) {
 const rpc=async(name,args={})=>{
  const {data,error}=await client.rpc('ikigai_'+level+'_'+name,args);
  if(error)throw error;
  return data;
 };
 async function withMedia(request, getExam) {
  const data=await request;
  if(prepare)await prepare(getExam(data));
  return data;
 }
 return {
  media,
  list:()=>rpc('list'),
  start:exam=>withMedia(rpc('start',{p_exam:exam}),a=>a.exam),
  answer:(id,section,index,value)=>rpc('answer',{p_attempt:id,p_section:section,p_index:index,p_value:value}),
  advance:(id,section)=>withMedia(rpc('advance',{p_attempt:id,p_section:section}),a=>a.result?null:a.exam),
  listen:id=>rpc('listen',{p_attempt:id}),
  recent:()=>rpc('recent'),
  review:id=>withMedia(rpc('review',{p_attempt:id}),r=>r.exam),
  teacherExam:id=>withMedia(rpc('teacher_exam',{p_exam:id}),e=>e),
  edit:(id,section,index,before,question)=>rpc('edit',{p_exam:id,p_section:section,p_index:index,p_before:before,p_question:question})
 };
}
