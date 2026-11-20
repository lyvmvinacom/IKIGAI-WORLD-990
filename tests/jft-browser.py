import threading, http.server, functools, pathlib, tempfile, os
from playwright.sync_api import sync_playwright, expect
root=pathlib.Path(__file__).resolve().parents[1]
fixture=root/'jft-browser-fixture.html'
fixture.write_text("""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel="stylesheet" href="jft-a2/world.css"><style>body{margin:0}#game{position:absolute;inset:0}#host{flex:1;min-height:0;overflow:auto;container:jft / inline-size} [hidden]{display:none!important} @media(orientation:portrait){#game{inset:auto;left:50%;top:50%;width:100vh;height:100vw;transform:translate(-50%,-50%) rotate(90deg)}}</style><div id=game><section class="world-jft-panel"><header class="world-jft-bar">IKIGAI WORLD</header><div id=host></div></section></div><script type=module>
import {mountJftPractice} from './jft-a2/app.js';
import {demo} from './jft-a2/demo.js';
demo.questions[0].figure='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
demo.questions[6].figure='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
await mountJftPractice(document.getElementById('host'),{signal:new AbortController().signal});
</script>""")
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/{fixture.name}'
def checks(browser,name,width,height):
    context=browser.new_context(viewport={'width':width,'height':height})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url)
    page.locator('#hero-start').click()
    page.locator('#simulation-mode').click()
    expect(page.locator('.simulation')).to_be_visible()
    expect(page.locator('.sim-stage')).to_have_count(5)
    expect(page.locator('.sim-footer-tools')).to_be_visible()
    expect(page.locator('#flag')).to_be_visible()
    if name!='rotated':
        assert page.locator('.q-bottom').bounding_box()['y'] > page.locator('.exam-grid').bounding_box()['y']
        assert page.locator('[data-jump="1"]').bounding_box()['y'] > page.locator('[data-jump="0"]').bounding_box()['y']
    if name!='desktop':
        expect(page.locator('.sim-compact')).to_be_visible()
        expect(page.locator('.world-jft-bar')).to_be_hidden()
        assert page.locator('.question').evaluate('(e)=>e.scrollHeight<=e.clientHeight+2'), 'picture and options must fit without scrolling'
        assert page.locator('.figure').evaluate('(e)=>e.offsetLeft') < page.locator('.choices').evaluate('(e)=>e.offsetLeft')
    else:
        expect(page.locator('.sim-compact')).to_have_count(0)
        expect(page.locator('.world-jft-bar')).to_be_visible()
    expect(page.locator('#previous')).to_be_disabled()
    page.locator('[data-answer="0"]').click()
    page.locator('#next').click()
    expect(page.locator('#q-heading')).to_contain_text('Câu 2')
    expect(page.locator('[data-jump="2"]')).to_have_count(0)
    page.screenshot(path=f'/tmp/jft-browser-{name}-exam.png')
    page.locator('#sim-finish').click()
    page.locator('#dismiss').click()
    expect(page.locator('#q-heading')).to_contain_text('Câu 2')
    page.locator('#sim-finish').click()
    page.locator('#confirm').click()
    expect(page.locator('#q-heading')).to_contain_text('Câu 3')
    expect(page.locator('[data-jump="0"]')).to_have_count(0)
    page.reload()
    page.locator('#hero-start').click()
    expect(page.locator('#q-heading')).to_contain_text('Câu 3')
    expect(page.locator('#previous')).to_be_disabled()
    page.locator('#sim-finish').click()
    page.locator('#confirm').click()
    expect(page.locator('#play')).to_be_visible()
    expect(page.locator('#listen-count')).to_be_visible()
    page.locator('#sim-finish').click()
    page.locator('#confirm').click()
    expect(page.locator('[data-figure]')).to_be_visible()
    page.locator('[data-figure]').click()
    expect(page.locator('.zoom-image')).to_be_visible()
    page.locator('#dismiss').click()
    page.locator('#sim-finish').click()
    page.locator('#confirm').click()
    page.locator('#show-review').click()
    page.locator('[data-review="0"] summary').click()
    expect(page.locator('[data-review="0"]')).to_contain_text('Giải thích')
    expect(page.locator('[data-review="0"]')).to_contain_text('うけつけ')
    page.screenshot(path=f'/tmp/jft-browser-{name}-result.png')
    page.locator('#retry').click()
    page.locator('#confirm').click()
    page.locator('#practice-mode').click()
    expect(page.locator('.simulation')).to_have_count(0)
    expect(page.locator('.world-jft-bar')).to_be_visible()
    page.locator('#palette').evaluate('(e)=>e.open=true')
    page.locator('[data-jump="4"]').click()
    expect(page.locator('#q-heading')).to_contain_text('Câu 5')
    page.locator('[data-jump="0"]').click()
    expect(page.locator('#q-heading')).to_contain_text('Câu 1')
    assert not errors, errors
    context.close()
    print(f'PASS {name}: simulation, section lock, reload, listening controls, image zoom, review explanations, practice',flush=True)
try:
    with sync_playwright() as p:
        for engine,name,w,h in [(p.chromium,'desktop',1280,800),(p.webkit,'landscape',844,390),(p.webkit,'rotated',390,844)]:
            browser=engine.launch()
            checks(browser,name,w,h)
            browser.close()
finally:
    server.shutdown()
    fixture.unlink(missing_ok=True)
