import {createJlptAdapter} from '../n4/adapter.js?v=shared-jlpt-2';

export function createN5Adapter(client) {
 const base=createJlptAdapter(client,'n5',{
  media(path) {
   if(typeof path!=='string'||!/^de0[1-5]\/[a-z0-9-]+\.(png|webp|svg|m4a)$/.test(path))return '';
   return new URL(path,import.meta.url).href;
  }
 });
 return {
  ...base,
  async renameTitle(id,title) {
   const {data,error}=await client.rpc('ikigai_n5_rename_title',{p_exam:id,p_title:title});
   if(error)throw error;
   return data;
  }
 };
}