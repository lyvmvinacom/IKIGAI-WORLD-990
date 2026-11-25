"""Exercise the real approval UI with mocked RPCs; never delete a live account."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
section = re.search(r'<section id="accountApproval".*?</section>', html).group(0)
now = datetime.now(timezone.utc)
def stamp(days):
    return (now - timedelta(days=days)).isoformat()
records = [
    dict(user_id='old', nickname='<QA old>', email='old@example.invalid', status='approved', requested_at=stamp(40), last_activity_at=stamp(31), is_online=False),
    dict(user_id='recent', nickname='QA recent', email='recent@example.invalid', status='approved', requested_at=stamp(5), last_activity_at=stamp(1), is_online=False),
    dict(user_id='never', nickname='QA never', email='never@example.invalid', status='pending', requested_at=stamp(20), last_activity_at=None, is_online=False),
    dict(user_id='online', nickname='QA online', email='online@example.invalid', status='approved', requested_at=stamp(40), last_activity_at=stamp(0), is_online=True),
]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport=dict(width=1366, height=768))
    page.set_content('<button id="openAccountApproval" hidden>Duyệt tài khoản <span id="approvalCount" hidden></span></button>' + section)
    page.add_style_tag(path=str(root / 'account-approval.css'))
    page.evaluate('''rows=>{window.rows=rows;window.calls=[];window.failDelete=false;window.ctx={role:'teacher',user:{app_metadata:{role:'teacher'}},client:{rpc:async(name,args)=>{calls.push({name,args});if(name==='ikigai_registration_list')return {data:rows};if(name==='ikigai_registration_delete')return failDelete?{error:{message:'Tài khoản vừa có hoạt động mới'}}:{data:{user_id:args.p_user_id,deleted:true}};return {data:{user_id:args.p_user_id,status:args.p_decision}};}}}}''', records)
    page.add_script_tag(path=str(root / 'account-approval.js'))
    page.evaluate('IKIGAI_APPROVALS.init(()=>ctx)')
    page.click('#openAccountApproval')
    page.select_option('#approvalFilter', 'all')
    assert page.locator('.approval-row').count() == 4
    assert page.locator('.approval-row h3').first.inner_text() == '<QA old>'
    assert page.locator('[data-delete="online"]').is_disabled()
    page.select_option('#approvalInactive', '30')
    assert page.locator('.approval-row').count() == 1
    page.select_option('#approvalInactive', '7')
    assert page.locator('.approval-row').count() == 2
    page.select_option('#approvalInactive', 'never')
    assert page.locator('.approval-row').count() == 1
    page.select_option('#approvalInactive', 'all')
    page.fill('#approvalSearch', 'old@example')
    assert page.locator('.approval-row').count() == 1
    # Cancel and wrong-email confirmation must never call the deletion RPC.
    page.once('dialog', lambda dialog: dialog.dismiss())
    page.click('[data-delete="old"]')
    assert page.evaluate('calls.filter(c=>c.name==="ikigai_registration_delete").length') == 0
    page.once('dialog', lambda dialog: dialog.accept('wrong@example.invalid'))
    page.click('[data-delete="old"]')
    assert 'không khớp' in page.locator('#approvalStatus').inner_text()
    assert page.evaluate('calls.filter(c=>c.name==="ikigai_registration_delete").length') == 0
    # Server rejection keeps the row; a confirmed success removes only that row.
    page.evaluate('failDelete=true')
    page.once('dialog', lambda dialog: dialog.accept('old@example.invalid'))
    page.click('[data-delete="old"]')
    assert 'hoạt động mới' in page.locator('#approvalStatus').inner_text()
    assert page.locator('.approval-row').count() == 1
    page.evaluate('failDelete=false')
    page.once('dialog', lambda dialog: dialog.accept('old@example.invalid'))
    page.click('[data-delete="old"]')
    assert 'Đã xoá tài khoản' in page.locator('#approvalStatus').inner_text()
    assert page.locator('.approval-row').count() == 0
    call = page.evaluate('calls.filter(c=>c.name==="ikigai_registration_delete").at(-1)')
    assert call['args']['p_expected_last_activity'] == records[0]['last_activity_at']
    page.fill('#approvalSearch', '')
    assert page.locator('.approval-row').count() == 3
    page.select_option('#approvalFilter', 'pending')
    page.click('[data-id="never"][data-decision="approved"]')
    assert 'Đã phê duyệt' in page.locator('#approvalStatus').inner_text()
    page.select_option('#approvalFilter', 'all')
    page.set_viewport_size(dict(width=844, height=390))
    assert page.evaluate('document.querySelector(".approval-panel").scrollWidth<=document.querySelector(".approval-panel").clientWidth')
    page.screenshot(path='/tmp/account-approval-landscape.png')
    page.evaluate("ctx.role='student';ctx.user.app_metadata.role='student';IKIGAI_APPROVALS.init(()=>ctx)")
    assert page.locator('#openAccountApproval').is_hidden()
    assert page.locator('#accountApproval').is_hidden()
    browser.close()
print('PASS: filters, activity, online guard, escaped names, cancel/wrong email, server rejection, successful deletion, approval regression, landscape layout, teacher-only UI')
