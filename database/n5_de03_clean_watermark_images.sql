begin;
update ikigai_n5_private.exams set payload=replace(payload::text,'.webp','.svg')::jsonb,revision=revision+1 where id='n5-de03';
commit;
