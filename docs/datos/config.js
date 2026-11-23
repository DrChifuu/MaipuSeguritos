/* ============================================================================
   CONFIGURACIÓN DE MAIPO VIGÍA
   Este es el único archivo que hay que tocar para conectar la base de datos.
   Por ahora el sitio funciona solo, guardando en el navegador (modo local).
   ========================================================================== */
window.MV_CONFIG = {

  /* Versión del formato de datos. Si cambia la forma del estado, subir el número:
     el sitio descarta lo guardado y vuelve a la semilla. */
  version: '2.1.0',

  /* Clave con la que se guarda el estado en el navegador. */
  clave: 'maipo_vigia_estado_v2',

  /* Minutos que se muestran como "actualizado hace N min" antes de avisar
     que la información del camino está vieja. */
  actualizacionMin: 2,

  /* --------------------------------------------------------------------------
     SUPABASE (fase 2). Mientras url y anonKey estén vacíos, el sitio es local.
     Pasos completos en supabase/LEEME.md.
     -------------------------------------------------------------------------- */
  supabase: {
    url: '',        // https://xxxxxxxxxxxx.supabase.co
    anonKey: ''     // la clave pública "anon", no la de servicio
  },

  /* Cómo se valida la tarjeta del observador.
     'local'    : contra la lista de observadores guardada en el navegador.
     'supabase' : contra la función mv_entrar() del servidor (recomendado al publicar). */
  auth: {
    modo: 'local'
  }
};
