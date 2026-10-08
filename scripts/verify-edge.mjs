import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const url='https://ixzvvyslbsuwnyhrxqwf.supabase.co',pub='sb_publishable_3Bi4Na9YOZSfotY7tGJxfw_1XFfvsNU';
const mk=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=mk(fs.readFileSync('.private/admin-key.txt','utf8').trim()),editor=mk(pub),analyst=mk(pub),consult=mk(pub);
const password=process.env.T3B_INITIAL_PASSWORD;
const accounts=JSON.parse(fs.readFileSync('.private/accounts.json','utf8'));
const emailFor=role=>accounts.find(a=>a.role===role).email;
const ok=r=>{if(r.error)throw r.error;return r.data};
let userId;
try{
 const ed=ok(await editor.auth.signInWithPassword({email:emailFor('editor'),password}));
 const an=ok(await analyst.auth.signInWithPassword({email:emailFor('analista'),password}));
 const invoke=(token,body)=>fetch(url+'/functions/v1/t3b-create-user',{method:'POST',headers:{apikey:pub,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await invoke(an.session.access_token,{email:'blocked@t3b.example',password,role:'editor'})).status,403);
 assert.equal((await invoke(pub,{})).status,401);
 const email=`qa-edge-${Date.now()}@t3b.example`;
 const result=await invoke(ed.session.access_token,{email,password,role:'consulta'});const body=await result.json();assert.equal(result.status,200,JSON.stringify(body));userId=body.id;
 assert.equal(ok(await admin.from('t3b_profiles').select('role').eq('id',userId).single()).role,'consulta');
 ok(await consult.auth.signInWithPassword({email,password}));assert.ok(ok(await consult.rpc('t3b_dashboard')).length>0);
 console.log('PASS: Editor cria conta e perfil; nova Consulta acessa dashboard; Analista e anônimo são bloqueados.');
}finally{for(const c of [editor,analyst,consult])await c.auth.signOut();if(userId){await admin.from('t3b_audit').delete().eq('actor_id',userId);ok(await admin.auth.admin.deleteUser(userId));}}
