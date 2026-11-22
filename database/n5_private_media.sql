-- Apply after approval, then upload the three original MP3s and derived images.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ikigai-n5-media','ikigai-n5-media',false,52428800,array['image/webp','audio/mpeg'])
on conflict(id) do update set public=false;
create policy n5_media_members on storage.objects for select to authenticated using (
 bucket_id='ikigai-n5-media' and name like 'n5/%' and auth.uid() is not null
 and coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
);
