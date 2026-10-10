async function boot(){
if(new URLSearchParams(location.search).get('view')==='playground'){
  await import('./main');
  const link=document.createElement('a');link.href='?view=reach';link.textContent='← RHYTHM REACH / DUO TRACKING';
  link.style.cssText='display:block;padding:12px;color:#79efff';document.body.prepend(link);
}else await import('./rhythm/app');
}
void boot().catch(error=>{document.querySelector('#app')!.textContent=`読み込みに失敗しました。ページを再読み込みしてください: ${String(error)}`});
// pagehide disposes streams/audio; do not revive disposed engines from the back/forward cache.
addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
export {};
