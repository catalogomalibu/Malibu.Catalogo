// MALIBU CATALOGO — Supabase + Realtime
// Solo coloca aquí el Project URL y la Publishable key. Nunca una service_role/secret key.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SUPABASE_URL = 'https://bqezmvsotlieeoxqwkdp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HrZhK-eLYJHKSFJT1bFpcA_e_mryzll';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
const money = n => '$' + Number(n || 0).toLocaleString('es-CL');
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE_NAME = 'MALIBU CATALOGO';
const DISCORD = 'https://discord.gg/DEPFcQg6p8';
let products = [], cart = {}, isAdmin = false, session = null, lastUpdated = new Date();
const status = msg => { $('admin-status').textContent = msg; };
function normalize(p) { return {id:String(p.id), name:p.nombre||'', description:p.descripcion||'', price:Number(p.precio)||0, stock:Number(p.stock)||0, image:p.imagen_url||'', active:p.activo!==false}; }
function render() {
  document.title=STORE_NAME;
  document.querySelector('.hero h1').textContent=STORE_NAME;
  $('total-stock').innerHTML=products.reduce((s,p)=>s+p.stock,0)+' <small>unidades</small>';
  $('total-products').textContent=products.length;
  $('updated').textContent='Actualizado: '+lastUpdated.toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'});
  $('discord-link').href=DISCORD;
  for(const id of Object.keys(cart)) {
    const p=products.find(x=>x.id===id);
    if(!p) delete cart[id]; else cart[id]=Math.min(cart[id],p.stock);
  }
  $('product-grid').innerHTML=products.map(p=>{
    const q=cart[p.id]||0, stock=p.stock;
    const img=p.image?`<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">`:'';
    return `<article class="product">${img}<div class="product-content"><div class="product-title-row"><h3>${escapeHtml(p.name)}</h3><span class="stock ${stock<=0?'out':''}">${stock>0?'EN STOCK':'AGOTADO'}</span></div><div class="price">${money(p.price)}</div><p class="product-desc">${escapeHtml(p.description)}</p><small class="muted">Disponibles: ${stock}</small><div class="buy-row"><div class="qty"><button data-action="minus" data-id="${p.id}" aria-label="Restar">−</button><span>${q}</span><button data-action="plus" data-id="${p.id}" aria-label="Sumar" ${q>=stock?'disabled':''}>+</button></div><button class="add" data-action="add" data-id="${p.id}" ${stock<=0?'disabled':''}>AGREGAR</button></div></div></article>`;
  }).join('');
  $('empty-state').classList.toggle('hidden',products.length>0);
  const entries=Object.entries(cart).filter(([,q])=>q>0);
  $('cart-count').textContent=entries.reduce((s,[,q])=>s+q,0);
  $('cart-total').textContent=money(entries.reduce((s,[id,q])=>s+(products.find(p=>p.id===id)?.price||0)*q,0));
  $('admin-product-list').innerHTML=products.map(p=>`<div class="admin-item"><div><strong>${escapeHtml(p.name)}</strong><small>${money(p.price)} · Stock: ${p.stock}</small></div><div><button class="secondary" data-admin="edit" data-id="${p.id}">Editar</button><button class="danger" data-admin="delete" data-id="${p.id}">Eliminar</button></div></div>`).join('')||'<p class="hint">No hay productos.</p>';
}
async function loadProducts() {
  const {data,error}=await supabase.from('productos').select('id,nombre,descripcion,precio,stock,imagen_url,activo,updated_at').order('id',{ascending:false});
  if(error){console.error(error);$('empty-state').textContent='No se pudo cargar el catálogo. Revisa la conexión y las políticas de Supabase.';$('empty-state').classList.remove('hidden');return;}
  products=(data||[]).filter(p=>p.activo!==false).map(normalize);
  lastUpdated=new Date(); render();
}
async function checkAdmin() {
  const {data:{session:s}}=await supabase.auth.getSession();session=s;
  if(!s){isAdmin=false;updateAdminView();return;}
  const {data,error}=await supabase.from('admin_users').select('user_id').eq('user_id',s.user.id).maybeSingle();
  isAdmin=!error&&!!data;
  updateAdminView();
}
function updateAdminView(){ $('login-view').classList.toggle('hidden',isAdmin);$('admin-view').classList.toggle('hidden',!isAdmin); }
$('year').textContent=new Date().getFullYear();
$('open-admin').onclick=async()=>{$('admin-dialog').showModal();await checkAdmin();};
$('close-admin').onclick=()=>$('admin-dialog').close();
$('login-btn').onclick=async()=>{
  $('login-error').textContent='Ingresando...';
  const email=$('admin-email').value.trim(),password=$('admin-password').value;
  if(!email||!password){$('login-error').textContent='Ingresa correo y contraseña.';return;}
  const {error}=await supabase.auth.signInWithPassword({email,password});
  $('admin-password').value='';
  if(error){$('login-error').textContent='No se pudo iniciar sesión: '+error.message;return;}
  await checkAdmin();
  $('login-error').textContent=isAdmin?'':'Esta cuenta no está autorizada en admin_users.';
};
$('admin-password').addEventListener('keydown',e=>{if(e.key==='Enter')$('login-btn').click();});
$('logout-btn').onclick=async()=>{await supabase.auth.signOut();isAdmin=false;updateAdminView();status('Sesión cerrada.');};
supabase.auth.onAuthStateChange(()=>{setTimeout(checkAdmin,0);});
$('product-grid').addEventListener('click',e=>{
  const b=e.target.closest('button[data-action]');if(!b)return;
  const p=products.find(x=>x.id===b.dataset.id);if(!p)return;
  const q=cart[p.id]||0;
  if(['plus','add'].includes(b.dataset.action)&&q<p.stock)cart[p.id]=q+1;
  if(b.dataset.action==='minus')cart[p.id]=Math.max(0,q-1);
  render();
});
$('copy-order').onclick=async()=>{
  const lines=Object.entries(cart).filter(([,q])=>q>0).map(([id,q])=>{const p=products.find(x=>x.id===id);return p?`${q} x ${p.name} — ${money(p.price*q)}`:'';}).filter(Boolean);
  if(!lines.length){$('copy-status').textContent='Primero agrega al menos un producto.';return;}
  const total=Object.entries(cart).reduce((s,[id,q])=>s+(products.find(p=>p.id===id)?.price||0)*q,0);
  const msg=`PEDIDO - ${STORE_NAME}\n${lines.join('\n')}\nTOTAL: ${money(total)}`;
  try{await navigator.clipboard.writeText(msg);$('copy-status').textContent='¡Pedido copiado! Pégalo en Discord.';}catch{$('copy-status').textContent=msg;}
};
function resetForm(){$('product-form').reset();$('edit-id').value='';$('form-title').textContent='Agregar producto';$('cancel-edit').classList.add('hidden');}
$('cancel-edit').onclick=resetForm;
$('product-form').onsubmit=async e=>{
  e.preventDefault();if(!isAdmin)return status('Inicia sesión como administrador.');
  const id=$('edit-id').value;
  const row={nombre:$('p-name').value.trim(),descripcion:$('p-description').value.trim(),precio:Number($('p-price').value),stock:Number($('p-stock').value),imagen_url:$('p-image').value.trim()||null,activo:true};
  if(!row.nombre||!Number.isInteger(row.precio)||row.precio<0||!Number.isInteger(row.stock)||row.stock<0)return status('Revisa nombre, precio y stock (números enteros positivos).');
  status('Guardando...');
  const result=id?await supabase.from('productos').update(row).eq('id',Number(id)).select('id'):await supabase.from('productos').insert(row).select('id');
  if(result.error){status('Error al guardar: '+result.error.message);return;}
  if(!result.data?.length){status('No se confirmó el cambio. Revisa los permisos de administración.');return;}
  resetForm();status('Producto guardado en Supabase.');await loadProducts();
};
$('admin-product-list').onclick=async e=>{
  const b=e.target.closest('button[data-admin]');if(!b||!isAdmin)return;
  const p=products.find(x=>x.id===b.dataset.id);if(!p)return;
  if(b.dataset.admin==='edit'){
    $('edit-id').value=p.id;$('p-name').value=p.name;$('p-description').value=p.description;$('p-price').value=p.price;$('p-stock').value=p.stock;$('p-image').value=p.image;
    $('form-title').textContent='Editar producto';$('cancel-edit').classList.remove('hidden');$('products-tab').scrollIntoView({behavior:'smooth'});
  }
  if(b.dataset.admin==='delete'&&confirm(`¿Eliminar ${p.name} de Supabase?`)){
    const {data,error}=await supabase.from('productos').delete().eq('id',Number(p.id)).select('id');
    if(error||!data?.length){status('No se pudo eliminar: '+(error?.message||'sin permisos'));return;}
    delete cart[p.id];status('Producto eliminado.');await loadProducts();
  }
};
$('export-data').onclick=()=>{
  const backup={format:'malibu-catalogo-backup-v1',createdAt:new Date().toISOString(),data:{storeName:STORE_NAME,discord:DISCORD,products,updated:lastUpdated.toISOString()}};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='malibu-catalogo-respaldo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import-local').onclick=async()=>{
  if(!isAdmin)return;
  let old;
  try{old=JSON.parse(localStorage.getItem('malibu_catalogo_v1')||'null');}catch{}
  const local=(old?.products||[]).filter(p=>p.name&&p.id!=='demo-1');
  if(!local.length)return status('No hay productos locales para importar en este navegador.');
  if(!confirm(`¿Importar ${local.length} productos locales a Supabase? Podrían duplicarse si ya los importaste.`))return;
  const rows=local.map(p=>({nombre:String(p.name),descripcion:String(p.description||''),precio:Math.max(0,Math.round(Number(p.price)||0)),stock:Math.max(0,Math.round(Number(p.stock)||0)),imagen_url:p.image||null,activo:true}));
  const {error}=await supabase.from('productos').insert(rows);
  if(error){status('Error al importar: '+error.message);return;}
  status('Productos importados.');await loadProducts();
};
render();loadProducts();checkAdmin();
supabase.channel('malibu-productos-live').on('postgres_changes',{event:'*',schema:'public',table:'productos'},()=>{loadProducts();}).subscribe();
