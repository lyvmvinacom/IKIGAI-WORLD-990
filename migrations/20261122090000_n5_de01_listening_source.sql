-- JLPT Official Practice Workbook (2012), N5L.pdf, printed listening pages 4–9.
-- Preserve prior attempt snapshots and the published answer order.
begin;

do $$
declare
 exam jsonb;
 question jsonb;
 patch record;
 path text[];
begin
 select payload into strict exam
 from ikigai_n5_private.exams where id = 'n5-de01' for update;

 for patch in
  select * from (values
   (4,  1, 5, 1, 'de01/listen-m1-q5.webp', null::jsonb),
   (5,  1, 6, 4, 'de01/listen-m1-q6.webp', null::jsonb),
   (6,  1, 7, 4, null, '["1ばん","3ばん","5ばん","7ばん"]'::jsonb),
   (7,  2, 1, 4, null, '["1じかん","2じかん","3じかん","4じかん"]'::jsonb),
   (8,  2, 2, 3, null, '["512-7733","512-7734","512-7743","512-7744"]'::jsonb),
   (9,  2, 3, 2, null, '["りょうしん","あね","いもうと","おとうと"]'::jsonb),
   (10, 2, 4, 4, null, '["しょくどう","きっさてん","パンや","きょうしつ"]'::jsonb),
   (11, 2, 5, 1, null, '["くろい　ボールペン","あかい　ボールペン","くろい　えんぴつ","あかい　えんぴつ"]'::jsonb),
   (12, 2, 6, 3, null, '["こうえん","えき","きっさてん","レストラン"]'::jsonb)
  ) as source(idx, mondai, local_number, answer, image, choices)
 loop
  path := array['sections','2','questions',patch.idx::text];
  question := exam #> path;
  if (question->>'mondai')::int is distinct from patch.mondai
   or (question->>'local')::int is distinct from patch.local_number
   or (question->>'options')::int is distinct from 4
   or (question->>'answer')::int is distinct from patch.answer - 1 then
   raise exception 'N5 đề 01: dữ liệu câu nghe % không khớp nguồn', patch.idx + 1;
  end if;
  question := question || jsonb_build_object(
   'prompt', 'Nghe và chọn đáp án.',
   'image', patch.image,
   'hideImage', patch.image is null,
   'optionTexts', coalesce(patch.choices, '["1","2","3","4"]'::jsonb)
  );
  exam := jsonb_set(exam, path, question);
 end loop;

 -- Preserve the printed glyph differences in choices that Unicode cannot encode.
 for patch in
  select * from (values
   (14, 'de01/vocab-q15-choices.webp'),
   (17, 'de01/vocab-q18-choices.webp')
  ) as source(idx, image)
 loop
  path := array['sections','0','questions',patch.idx::text];
  question := exam #> path;
  if question->>'image' is distinct from 'de01/page-03.webp'
   and question->>'image' is distinct from patch.image then
   raise exception 'N5 đề 01: không khớp ảnh nguồn câu từ vựng %', patch.idx + 1;
  end if;
  exam := jsonb_set(exam, path, (question - 'imageCrop') || jsonb_build_object('image', patch.image));
 end loop;

 exam := jsonb_set(exam, '{listeningDirections,1}', '"de01/listen-m2-guide.webp"');
 update ikigai_n5_private.exams
 set payload = exam, revision = revision + 1
 where id = 'n5-de01' and payload is distinct from exam;
end $$;

commit;
