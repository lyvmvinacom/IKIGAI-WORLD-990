// Run from any directory: node database/seed-hyogen.mjs > hyogen_seed.sql
// Does not overwrite existing question sets with conflicting content.
import {practiceSets} from '../jft-drills/hyogen-bank.js';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
for(const [i,t] of practiceSets.entries())console.log(`insert into public.ikigai_jft_drill_sets(id,position,title,payload) values(${quote(t.id)},${1001+i},${quote(t.title)},${quote(JSON.stringify(t))}::jsonb) on conflict(id) do nothing;`);
