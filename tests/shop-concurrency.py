"""Disposable CI PostgreSQL only. Duplicate clicks and an independent wallet award."""
import concurrent.futures,json,subprocess
uid='00000000-0000-4000-8000-000000000001'
def sql(q):
 return subprocess.check_output(['psql','-h','localhost','-U','postgres','-d','shoptest','-v','ON_ERROR_STOP=1','-Atc',q],text=True).strip()
def purchase():
 return sql("begin; set local role authenticated; select set_config('request.jwt.claims','"+json.dumps({'sub':uid,'role':'authenticated','is_anonymous':False})+"',true); select public.ikigai_shop_purchase('VIP007',30000); commit;")
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 jobs=[pool.submit(purchase),pool.submit(purchase),pool.submit(sql,"update public.ikigai_world_profiles set coins=coins+2 where user_id='"+uid+"';")]
 results=[j.result() for j in jobs]
assert sum('"purchased"' in r for r in results)==1,results
assert sum('already_owned' in r for r in results)==1,results
assert sql('select coins from public.ikigai_world_profiles')=='20002'
assert sql('select count(*) from ikigai_shop_private.ledger')=='1'
assert sql('select count(*) from ikigai_shop_private.inventory')=='1'
assert sql('select xp from public.ikigai_world_profiles')=='123'
print('PASS: simultaneous duplicate purchase + wallet award; one charge; XP preserved')
