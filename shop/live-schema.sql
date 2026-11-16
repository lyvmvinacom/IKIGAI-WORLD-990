-- Live shop: additive schema; existing learning/reward functions stay unchanged.
create schema ikigai_shop_private;
revoke all on schema ikigai_shop_private from public, anon, authenticated;
grant usage on schema ikigai_shop_private to authenticated;
create table ikigai_shop_private.settings(id boolean primary key check(id), enabled boolean not null default false);
insert into ikigai_shop_private.settings values(true,true);
create table ikigai_shop_private.catalog(id text primary key, kind text not null check(kind in ('character','pet')), name text not null, price integer not null check(price>=1000), rarity text not null check(rarity in ('R','SR','SSR','UR')), published boolean not null default false, unique(id,kind));
insert into ikigai_shop_private.catalog(id,kind,name,price,rarity,published) values
('VIP001','character','Samurai Lam Vũ',3000,'R',true),
('VIP002','character','Công chúa Sakura',3000,'R',true),
('VIP003','character','Chiến thần băng giá',8000,'SR',true),
('VIP004','character','Nữ hoàng băng tuyết',8000,'SR',true),
('VIP005','character','Samurai Hỏa Long',7000,'SR',true),
('VIP006','character','Nữ kiếm sĩ Hỏa Hoa',7000,'SR',true),
('VIP007','character','Long đế hoàng kim',30000,'UR',true),
('VIP008','character','Thiên sứ hoàng kim',30000,'UR',true),
('VIP009','character','Ninja Bạch Ảnh',4000,'SR',true),
('VIP010','character','Nữ Ninja Hắc Nguyệt',4000,'SR',true),
('VIP011','character','Học giả tri thức',2000,'R',true),
('VIP012','character','Nữ pháp sư tri thức',2000,'R',true),
('VIP013','character','Học viên năng động',1000,'R',true),
('VIP014','character','Nữ học viên năng động',1000,'R',true),
('VIP015','character','Hồ ly Bạch Vũ',6000,'SR',true),
('VIP016','character','Nữ thần hồ ly',6000,'SR',true),
('VIP017','character','Long thần đại dương',18000,'SSR',true),
('VIP018','character','Long nữ thiên giới',18000,'SSR',true),
('VIP019','character','Ma pháp sư bóng tối',13000,'SSR',true),
('VIP020','character','Nữ hoàng tử nguyệt',13000,'SSR',true),
('VIP021','character','Thần tiễn rừng xanh',10000,'SSR',true),
('VIP022','character','Tiên nữ rừng xanh',10000,'SSR',true),
('VIP023','character','Chiến thần hỏa diễm',23000,'UR',true),
('VIP024','character','Nữ thần phượng hoàng',23000,'UR',true),
('PET001','pet','Hồ Ly Bạch Vũ',4000,'SR',true),
('PET002','pet','Tiểu Long Băng',5000,'SR',true),
('PET003','pet','Phượng Hoàng Lửa',12500,'UR',true),
('PET004','pet','Gấu Học Tập',1500,'R',true),
('PET005','pet','Mèo Thiên Sứ',6000,'SSR',true),
('PET006','pet','Kỳ Lân Hộ Vệ',10000,'SSR',true),
('PET007','pet','Thỏ Năng Động',2000,'R',true),
('PET008','pet','Rùa Tri Thức',2500,'R',true),
('PET009','pet','Cá Voi May Mắn',4500,'SR',true),
('PET010','pet','Mèo Ninja',3000,'SR',true);
create table ikigai_shop_private.inventory(user_id uuid references public.ikigai_world_profiles(user_id) on delete cascade, item_id text references ikigai_shop_private.catalog(id), acquired_at timestamptz not null default now(), primary key(user_id,item_id));
create table ikigai_shop_private.ledger(user_id uuid references public.ikigai_world_profiles(user_id) on delete cascade, item_id text references ikigai_shop_private.catalog(id), price integer not null check(price>0), balance_after integer not null check(balance_after>=0), created_at timestamptz not null default now(), primary key(user_id,item_id));
create table ikigai_shop_private.equipment(user_id uuid, kind text, item_id text not null, primary key(user_id,kind), foreign key(user_id,item_id) references ikigai_shop_private.inventory(user_id,item_id) on delete cascade, foreign key(item_id,kind) references ikigai_shop_private.catalog(id,kind));

create table public.ikigai_world_cosmetics(
 user_id uuid primary key references public.ikigai_world_profiles(user_id) on delete cascade,
 character_id text, pet_id text, updated_at timestamptz not null default now(),
 check(character_id is null or character_id ~ '^VIP[0-9]{3}$'),
 check(pet_id is null or pet_id ~ '^PET[0-9]{3}$'),
 foreign key(user_id,character_id) references ikigai_shop_private.inventory(user_id,item_id),
 foreign key(user_id,pet_id) references ikigai_shop_private.inventory(user_id,item_id)
);
alter table public.ikigai_world_cosmetics enable row level security;
revoke all on public.ikigai_world_cosmetics from public,anon,authenticated;
grant select on public.ikigai_world_cosmetics to anon,authenticated;
create policy cosmetic_display on public.ikigai_world_cosmetics for select to anon,authenticated using(true);

alter table ikigai_shop_private.settings enable row level security;
alter table ikigai_shop_private.catalog enable row level security;
alter table ikigai_shop_private.inventory enable row level security;
alter table ikigai_shop_private.ledger enable row level security;
alter table ikigai_shop_private.equipment enable row level security;
revoke all on all tables in schema ikigai_shop_private from public, anon, authenticated;
create function ikigai_shop_private.purchase(p_item text,p_expected_price integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); bal integer; pr integer; student_role text;
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from ikigai_shop_private.settings where id and enabled) then raise exception 'SHOP_DISABLED'; end if;
 select coins,role into bal,student_role from public.ikigai_world_profiles where user_id=u for update;
 if not found or student_role is distinct from 'student' or auth.jwt()->'app_metadata'->>'role'='teacher' then raise exception 'STUDENT_REQUIRED'; end if;
 if exists(select 1 from ikigai_shop_private.inventory where user_id=u and item_id=p_item) then return jsonb_build_object('status','already_owned','coins',bal); end if;
 select price into pr from ikigai_shop_private.catalog where id=p_item and published for share;
 if not found then raise exception 'ITEM_UNAVAILABLE'; end if;
 if p_expected_price is distinct from pr then raise exception 'PRICE_CHANGED'; end if;
 if bal<pr then raise exception 'INSUFFICIENT_COINS'; end if;
 update public.ikigai_world_profiles set coins=coins-pr where user_id=u returning coins into bal;
 insert into ikigai_shop_private.inventory(user_id,item_id) values(u,p_item);
 insert into ikigai_shop_private.ledger(user_id,item_id,price,balance_after) values(u,p_item,pr,bal);
 return jsonb_build_object('status','purchased','coins',bal,'item_id',p_item);
end $$;
create function ikigai_shop_private.state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); bal integer; active boolean;
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'AUTH_REQUIRED'; end if;
 select enabled into active from ikigai_shop_private.settings where id;
 select coins into bal from public.ikigai_world_profiles where user_id=u;
 if bal is null then raise exception 'PROFILE_REQUIRED'; end if;
 return jsonb_build_object('profile',(select jsonb_build_object('nickname',nickname,'gender',gender,'avatar',avatar,'xp',xp,'role',role) from public.ikigai_world_profiles where user_id=u),'enabled',active,'coins',bal,'catalog',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from ikigai_shop_private.catalog c where c.published and active),'[]'::jsonb),'inventory',coalesce((select jsonb_agg(to_jsonb(i)-'user_id') from ikigai_shop_private.inventory i where i.user_id=u),'[]'::jsonb),'equipment',coalesce((select jsonb_agg(to_jsonb(e)-'user_id') from ikigai_shop_private.equipment e where e.user_id=u),'[]'::jsonb));
end $$;
create function ikigai_shop_private.equip(p_kind text,p_item text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from ikigai_shop_private.settings where id and enabled) then raise exception 'SHOP_DISABLED'; end if;
 if p_kind is null or p_kind not in ('character','pet') then raise exception 'INVALID_KIND'; end if;
 perform 1 from public.ikigai_world_profiles where user_id=u and role='student' for update;
 if not found or auth.jwt()->'app_metadata'->>'role'='teacher' then raise exception 'STUDENT_REQUIRED'; end if;
 if p_item is null then delete from ikigai_shop_private.equipment where user_id=u and kind=p_kind;
 else
 if not exists(select 1 from ikigai_shop_private.inventory i join ikigai_shop_private.catalog c on c.id=i.item_id where i.user_id=u and i.item_id=p_item and c.kind=p_kind) then raise exception 'NOT_OWNED'; end if;
 insert into ikigai_shop_private.equipment values(u,p_kind,p_item) on conflict(user_id,kind) do update set item_id=excluded.item_id;
 end if;
 insert into public.ikigai_world_cosmetics(user_id,character_id,pet_id,updated_at)
 values(u,(select item_id from ikigai_shop_private.equipment where user_id=u and kind='character'),(select item_id from ikigai_shop_private.equipment where user_id=u and kind='pet'),now())
 on conflict(user_id) do update set character_id=excluded.character_id,pet_id=excluded.pet_id,updated_at=excluded.updated_at;
 return jsonb_build_object('kind',p_kind,'item_id',p_item);
end $$;
revoke all on all functions in schema ikigai_shop_private from public,anon,authenticated;
grant execute on function ikigai_shop_private.purchase(text,integer),ikigai_shop_private.state(),ikigai_shop_private.equip(text,text) to authenticated;
create function public.ikigai_shop_purchase(p_item text,p_expected_price integer) returns jsonb language sql security invoker set search_path='' as $$ select ikigai_shop_private.purchase(p_item,p_expected_price) $$;
create function public.ikigai_shop_state() returns jsonb language sql security invoker set search_path='' as $$ select ikigai_shop_private.state() $$;
create function public.ikigai_shop_equip(p_kind text,p_item text) returns jsonb language sql security invoker set search_path='' as $$ select ikigai_shop_private.equip(p_kind,p_item) $$;
revoke all on function public.ikigai_shop_purchase(text,integer),public.ikigai_shop_state(),public.ikigai_shop_equip(text,text) from public,anon,authenticated;
grant execute on function public.ikigai_shop_purchase(text,integer),public.ikigai_shop_state(),public.ikigai_shop_equip(text,text) to authenticated;

