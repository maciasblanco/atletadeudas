/* ============================================================
   categorias.js — Cálculo de categoría y edad (FVV)
   ============================================================ */

export function calcularCategoriaPorEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";

  const anioNacimiento = parseInt(String(fechaNacimiento).split('-')[0], 10);
  if (!anioNacimiento || isNaN(anioNacimiento)) return "";

  if (anioNacimiento >= 2015) return "SEMILLAS";
  if (anioNacimiento >= 2013) return "MINI";        // 2013 - 2014
  if (anioNacimiento >= 2011) return "INFANTIL";    // 2011 - 2012
  if (anioNacimiento >= 2009) return "PRE-JUVENIL"; // 2009 - 2010
  if (anioNacimiento >= 2007) return "JUVENIL";     // 2007 - 2008
  return "MAYOR";                                   // 2006 y anteriores
}

export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  const hoy = new Date();
  
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  
  return edad;
}