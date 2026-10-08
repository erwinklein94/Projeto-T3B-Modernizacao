import {createClient} from 'npm:@supabase/supabase-js@2.114.0';
const cors={'Access-Control-Allow-Origin':'https://erwinklein94.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!;
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply({error:'Autenticação necessária'},401);
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)return reply({error:'Sessão inválida'},401);
  const {data:profile}=await admin.from('t3b_profiles').select('role,active').eq('id',user.id).single();
  if(profile?.role!=='editor'||!profile.active)return reply({error:'Acesso exclusivo do Editor'},403);
  const {email,password,role}=await req.json();
  if(typeof email!=='string'||!email.includes('@')||email.length>254||typeof password!=='string'||password.length<8||!['editor','coordenador','analista','consulta'].includes(role))return reply({error:'E-mail, senha ou perfil inválido'},400);
  const {data,error}=await admin.auth.admin.createUser({email:email.trim().toLowerCase(),password,email_confirm:true,app_metadata:{t3b_role:role}});
  if(error)return reply({error:error.message},400);
  const {error:profileError}=await admin.from('t3b_profiles').upsert({id:data.user.id,email:data.user.email,role,active:true});
  if(profileError){
   await admin.auth.admin.deleteUser(data.user.id);
   return reply({error:'Não foi possível configurar o perfil. Tente novamente.'},500);
  }
  return reply({id:data.user.id,email:data.user.email,role});
 }catch{return reply({error:'Não foi possível criar a conta'},500)}
});
