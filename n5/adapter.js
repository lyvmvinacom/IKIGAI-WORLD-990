// Exam keys remain private; public GitHub media contains only question images and original audio.
export function createN5Adapter(client){
 const mediaBase=new URL('./',import.meta.url);
 const rpc=async(name,args={})=>{const {data,error}=await client.rpc(name,args);if(error)throw error;return data};
 async function prepare(exam){if(!exam)return;}
 function media(p){if(typeof p!=='string'||!/^de01\/[a-z0-9-]+\.(webp|m4a)$/.test(p))return '';return new URL(p,mediaBase).href;}
 return {media,list:()=>rpc('ikigai_n5_list'),start:async exam=>{const a=await rpc('ikigai_n5_start',{p_exam:exam});await prepare(a.exam);return a},answer:(id,section,index,value)=>rpc('ikigai_n5_answer',{p_attempt:id,p_section:section,p_index:index,p_value:value}),advance:async(id,section)=>{const a=await rpc('ikigai_n5_advance',{p_attempt:id,p_section:section});if(!a.result)await prepare(a.exam);return a},listen:id=>rpc('ikigai_n5_listen',{p_attempt:id}),recent:()=>rpc('ikigai_n5_recent'),review:async id=>{const r=await rpc('ikigai_n5_review',{p_attempt:id});await prepare(r.exam);return r},teacherExam:async id=>{const e=await rpc('ikigai_n5_teacher_exam',{p_exam:id});await prepare(e);return e},edit:(id,section,index,before,question)=>rpc('ikigai_n5_edit',{p_exam:id,p_section:section,p_index:index,p_before:before,p_question:question})};
}
