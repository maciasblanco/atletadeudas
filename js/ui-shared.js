/* ============================================================
   ui-shared.js — Funciones de UI compartidas
   ============================================================ */

export function mostrarVista(id){
  ['view-loading','view-login','view-atleta','view-admin'].forEach(v=>{
    const el = document.getElementById(v); 
    if(el) el.classList.toggle('hidden', v!==id);
  });
}