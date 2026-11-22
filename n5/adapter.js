import {createJlptAdapter} from '../n4/adapter.js?v=shared-jlpt-1';

export function createN5Adapter(client) {
 return createJlptAdapter(client,'n5',{
  media(path) {
   if(typeof path!=='string'||!/^de0[12]\/[a-z0-9-]+\.(webp|m4a)$/.test(path))return '';
   return new URL(path,import.meta.url).href;
  }
 });
}
