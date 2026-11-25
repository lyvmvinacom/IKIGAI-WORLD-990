import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(await readFile(new URL('../teacher-login.js',import.meta.url),'utf8'),context);
const login=context.window.IKIGAI_TEACHER_LOGIN;
test('teacher IDs resolve without changing existing email login',()=>{
 assert.equal(login.email(' giaovienikigai01 '),'giaovienikigai01@accounts.ikigai.invalid');
 assert.equal(login.email('GIAOVIENIKIGAI02'),'giaovienikigai02@accounts.ikigai.invalid');
 assert.equal(login.email(' existing@example.com '),'existing@example.com');
 assert.equal(login.email(''), '');
});
test('new teacher accounts display their ID; original teacher keeps the approved name',()=>{
 assert.equal(login.displayName({email:'giaovienikigai01@accounts.ikigai.invalid'}),'giaovienikigai01');
 assert.equal(login.displayName({email:'giaovienikigai02@accounts.ikigai.invalid'}),'giaovienikigai02');
 assert.equal(login.displayName({email:'existing@example.com'}),'リー先生');
});
