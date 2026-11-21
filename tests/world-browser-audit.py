import pathlib, threading, http.server, functools
from playwright.sync_api import sync_playwright, expect
root=pathlib.Path(__file__).resolve().parents[1]
fixture=root/'audit-fixture.html'
fixture.write_text("""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}#game{position:absolute;inset:0;background:#173e52}#mapScene{position:absolute;inset:0}[hidden]{display:none!important}</style><div id=game><div id=mapScene></div></div><script src=shop/map-entry.js></script><script src=learning-tasks.js></script><script>
const student='test-student', items=[{id:'one',room:'class',source:'bunpou',title:'Bài 1',completed:false,status:'not_started'},{id:'two',room:'class',source:'kanji_bomb',title:'Bài 2',completed:true,status:'completed',best_percent:100}];
const catalog=[{room:'class',category:'Kanji',source:'kanji_bomb',lesson_key:'kanji-bomb:1',title:'Bài 1'},{room:'class',category:'Bunpou',source:'bunpou',lesson_key:'minna:1:grammar',title:'Bài 1'},{room:'jft',category:'JFT',source:'jft_exam',lesson_key:'exam:1',title:'Đề 1'}];
window.calls=[];window.fakeRole='teacher';window.items=items;
const client={rpc:async(n,p)=>{calls.push([n,p]);return {data:n==='ikigai_tasks_students'?[{user_id:student,nickname:'Học viên thử'}]:n==='ikigai_tasks_catalog'?catalog:n==='ikigai_tasks_list'?items:n==='ikigai_tasks_batch'?{added:p.p_tasks.length,skipped:0}:n==='ikigai_tasks_archive'?(items.splice(items.findIndex(x=>x.id===p.p_id),1),true):[]}}};
window.initAudit=()=>IKIGAI_TASKS.init(()=>({role:fakeRole,user:{id:student},client}),r=>window.navigated=r);
initAudit();
</script>""")
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
def run(browser,name,viewport,mobile=False):
 ctx=browser.new_context(viewport=viewport,has_touch=mobile)
 page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(base+'/audit-fixture.html')
 page.locator('.ik-task-entry').click()
 expect(page.locator('#ik-task-form')).to_be_visible()
 page.locator('[name=student]').select_option('test-student')
 page.locator('[data-key="kanji_bomb|kanji-bomb:1"]').check()
 page.locator('[name=room]').select_option('jft')
 page.locator('[data-key="jft_exam|exam:1"]').check()
 expect(page.locator('#batch-total')).to_contain_text('2')
 assert page.locator('#ik-task-panel main').evaluate('(e)=>e.scrollWidth<=e.clientWidth+2'), 'mission horizontal overflow'
 page.screenshot(path=f'/tmp/audit-{name}-teacher.png')
 page.locator('#ik-task-form button[type=submit]').click()
 expect(page.locator('#ik-task-message')).to_contain_text('Đã giao 2')
 assert page.evaluate("calls.filter(x=>x[0]==='ikigai_tasks_batch').at(-1)[1].p_tasks.length") == 2
 page.locator('#ik-task-close').click()
 page.evaluate("async()=>{fakeRole='student';await initAudit()}")
 expect(page.locator('.task-count')).to_have_text('1')
 page.locator('.ik-task-entry').click()
 expect(page.locator('.entry.complete')).to_have_count(1)
 page.locator('[data-filter=done]').click()
 expect(page.locator('.entry')).to_have_count(1)
 page.screenshot(path=f'/tmp/audit-{name}-student.png')
 page.locator('#ik-task-close').click()
 for label in ['Shop','Túi đồ và nhân vật']:
  page.get_by_role('button',name=label,exact=True).click()
  expect(page.locator('#ik-shop-overlay iframe')).to_be_visible()
  page.locator('#ik-shop-overlay header button').click()
 assert not errors,errors
 print('PASS',name,'mission cart, submission, filter, badge, shop and bag launch',flush=True)
 ctx.close()
try:
 with sync_playwright() as p:
  for engine,name,v,m in [(p.chromium,'desktop',{'width':1280,'height':800},False),(p.webkit,'iphone-landscape',{'width':844,'height':390},True),(p.webkit,'iphone-small',{'width':667,'height':375},True)]:
   b=engine.launch();run(b,name,v,m);b.close()
finally:
 server.shutdown();fixture.unlink(missing_ok=True)
