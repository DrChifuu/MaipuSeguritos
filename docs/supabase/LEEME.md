# Conectar Maipo Vigía a Supabase

El sitio funciona **sin base de datos**: guarda en el navegador (`localStorage`). Este documento
explica cómo pasar a un servidor para que los datos sean los mismos para todos.

No hay que reescribir pantallas. El sitio habla con una sola puerta, `assets/almacen.js`, y esa
puerta cambia de destino cuando `datos/config.js` tiene `url` y `anonKey`. Las funciones que
espera están en `esquema.sql`.

---

## 1. Crear el proyecto

1. Entrar a <https://supabase.com> y crear un proyecto (el plan gratuito sirve para empezar).
2. Guardar la contraseña de la base de datos en un lugar seguro. No va en el sitio.
3. Esperar a que el proyecto termine de aprovisionarse.

## 2. Crear las tablas y las funciones

1. En el panel del proyecto: **SQL Editor → New query**.
2. Pegar todo el contenido de `esquema.sql`.
3. Ejecutar (**Run**). No debería devolver errores.
4. Revisar en **Table Editor** que existan `mv_puntos`, `mv_tramos`, `mv_lecturas`,
   `mv_observadores`, `mv_sesiones` y `mv_estado_snapshot`.

El script crea seis puntos **sin equipo instalado** (`tiene_sensor = false`, estado «Equipo no
instalado todavía»), seis tramos sin reporte y tres tarjetas de ejemplo. **Cambiar las claves de
esas tarjetas antes de publicar** (ver §6).

## 3. Copiar las llaves

En **Project Settings → API**:

- `Project URL` → va en `supabase.url`
- `anon public` → va en `supabase.anonKey`

La clave `anon` es pública por diseño: puede ir en el HTML. Lo que protege los datos son las
políticas RLS y las funciones, no el secreto de esa clave. **La clave `service_role` no se pone
nunca en el sitio.**

## 4. Completar `datos/config.js`

```js
supabase: {
  url: 'https://tuproyecto.supabase.co',
  anonKey: 'eyJhbGciOi...'
},
auth: {
  modo: 'supabase'
}
```

Además de la conexión, ese archivo define la zona horaria y los umbrales del semáforo. Cambiarlos
ahí no requiere tocar la aplicación.

Con esos valores:

- al abrir, el sitio pide `mv_estado_publico()` y muestra el último tablero publicado;
- la tarjeta se valida contra `mv_entrar()`, con la clave hasheada en el servidor;
- la directiva publica con `mv_guardar_estado()`;
- el observador registra con `mv_registrar_lectura()`;
- la directiva confirma un tramo con `mv_confirmar_tramo()`.

Si `url` o `anonKey` están vacíos, todo sigue funcionando en modo local, con la etiqueta
«Datos de ejemplo» en el pie.

## 5. Cómo viaja la sesión

La clave `anon` y la sesión de tarjeta son cosas distintas y viajan por canales distintos:

- **Cabecera `Authorization`:** siempre `Bearer <anonKey>`. El UUID de `mv_sesiones` nunca se
  pone ahí.
- **Cuerpo de la llamada:** `p_token: <uuid>` en las funciones que exigen sesión.
- **Cliente:** `sessionStorage` guarda solo el UUID; se borra al cerrar sesión o al cerrar la
  pestaña.
- **Servidor:** `mv_sesion(p_token)` revisa que exista, que no esté vencida y que la tarjeta siga
  acreditada.

El token dura 8 horas y las sesiones vencidas se limpian al entrar.

## 6. Saneamiento de credenciales

Antes de publicar, el estado del navegador trae cosas que no pueden salir de ahí: la sesión, los
intentos de login y las credenciales de las tarjetas.

- **En el cliente**, `sanearParaPublicar()` clona el estado, quita `session`,
  `loginAttempts`, `lockoutUntil` y `_version`, y reemplaza `card` y `pin` por `cardLast2`
  (o `••` cuando no hay tarjeta).
- **En el servidor**, `mv_guardar_estado()` vuelve a quitar esas llaves y a borrar `card` y
  `pin` de cada observador antes de escribir el snapshot. No confía en el cliente.

## 7. Funciones disponibles

| Función | Quién | Qué hace |
|---|---|---|
| `mv_entrar(codigo, pin)` | público | valida tarjeta y clave, devuelve observador y token |
| `mv_salir(token)` | con sesión | elimina la sesión del servidor |
| `mv_registrar_lectura(...)` | observador o directiva | inserta una lectura; `p_oficial` solo para directiva |
| `mv_confirmar_tramo(...)` | directiva | registra un estado de camino |
| `mv_guardar_estado(token, estado)` | directiva | publica el snapshot saneado |
| `mv_estado_publico()` | público | devuelve el último tablero publicado |
| `mv_crear_observador(...)` | directiva | crea tarjeta nueva con hash y PIN |
| `mv_cambiar_pin_observador(...)` | directiva | cambia la clave y, opcionalmente, el código |
| `mv_cambiar_estado_observador(...)` | directiva | acredita o suspende una tarjeta |
| `mv_hash_tarjeta(codigo)` | interno | HMAC del código con el secreto del proyecto |

Los códigos se guardan como HMAC-SHA256 con un secreto del proyecto; las claves, con bcrypt.
Nunca se guarda el número de tarjeta ni la clave en texto plano.

`mv_lecturas.mm` acepta `NULL` para representar «Sin dato»: una lectura sin dato no es un cero.

### Estado inicial y vigencia

- Los seis puntos parten como «Equipo no instalado» y «Sin dato», sin lecturas ni avisos
  previos. Así se ve el tablero hasta que exista una medición válida.
- Una medición vale **1 hora (60 minutos)**. Pasado ese plazo, el punto vuelve a «Sin dato»;
  el cálculo lo hace el cliente con los umbrales de `datos/config.js`.
- Los cierres diarios en **CSV** (`lluvia_diaria_AAAA-MM-DD.csv`) los arma el cliente y viajan
  dentro del snapshot que publica la directiva. No hay una tabla aparte para ellos.
- El enfriamiento de **2 minutos** entre avisos y la cancelación del aviso propio son estado
  del cliente (`avisarCooldownUntil`, `myReportIds`); no reemplazan un límite por IP en el
  servidor.
- La paleta pizarra-carbón del kiosco es solo presentación y no cambia el contrato de datos.

## 8. Publicar el tablero

El sitio es estático: no necesita servidor propio, solo GitHub Pages sobre `docs/`.

1. Entrar como directiva.
2. Validar o ingresar lecturas.
3. En **Directiva → Datos**, confirmar que el estado es «Supabase» y usar «Sincronizar ahora».
4. Al guardar, el sitio publica el estado completo en `mv_estado_snapshot`, incluidos los
   cierres diarios CSV que haya generado el cliente.

El tablero público lee ese snapshot, no consulta las tablas una por una. Es deliberado: la
página queda rápida, funciona con mala señal y el JSON tiene exactamente la forma que el sitio
sabe dibujar.

## 9. Antes de publicar de verdad

- [ ] Cambiar las claves de las tres tarjetas de ejemplo.
- [ ] Borrar o suspender las tarjetas que no correspondan.
- [ ] Instalar los equipos y marcar cada punto con su sensor cuando corresponda.
- [ ] Definir los umbrales y la vigencia de 1 hora con Sernageomin, y actualizarlos en
  `datos/config.js`.
- [ ] Probar en el teléfono: entrar, registrar, validar, subir un archivo.
- [ ] Guardar un respaldo (**Directiva → Datos → Descargar**).
- [ ] Activar respaldos automáticos de Supabase o programar un `pg_dump`.

## 10. Qué queda pendiente para una segunda iteración

| Tema | Estado | Qué falta |
|---|---|---|
| Límite de intentos por IP | Básico | contar intentos en una Edge Function; hoy el bloqueo es local |
| Fotos de lecturas | Local | las fotos se comprimen y quedan en el snapshot; para volumen alto, mover a Storage |
| Avisos de camino | Parcial | `mv_confirmar_tramo` existe; falta la cola de avisos en el servidor |
| Datos en vivo entre pestañas | No | Realtime o revalidar cada 2 minutos |
| Recuperar una clave | Cubierto | la directiva puede generar una nueva desde la ficha del observador |
| Crear tarjetas desde el sitio | Cubierto | `mv_crear_observador` y el alta local comparten el mismo flujo |

## 11. Cómo está armado

```
datos/config.js        → url, anonKey, zona horaria, umbrales y modo de autenticación
assets/almacen.js      → cargar, guardar, traer, entrar, salir, sincronizar, registrar, confirmar
supabase/esquema.sql   → tablas, RLS y funciones
assets/maipo.js        → pantallas; no sabe si los datos son locales o remotos
```

`almacen.js` expone:

```js
MV_ALMACEN.modo                  // 'local' | 'supabase'
MV_ALMACEN.cargar()              // estado guardado en el navegador
MV_ALMACEN.guardar(e)            // guarda local y empuja con retardo
MV_ALMACEN.traer()               // estado publicado
MV_ALMACEN.entrar(c, p)          // { ok, observador, token }
MV_ALMACEN.salir()               // cierra sesión en servidor y borra token
MV_ALMACEN.sincronizarAhora(e)   // publica y espera resultado
MV_ALMACEN.registrarLectura(d)   // inserta lectura
MV_ALMACEN.confirmarTramo(d)     // confirma camino
MV_ALMACEN.sanearParaPublicar(e) // copia sin credenciales
MV_ALMACEN.respaldar(e)          // descarga un JSON con todo
```

## 12. Seguridad, en simple

- La tarjeta se guarda como HMAC con un secreto del proyecto; nunca el número.
- La clave se guarda con bcrypt; nunca en texto plano.
- El público solo lee. Escribir exige token de sesión y, para publicar, rol directiva.
- El token dura 8 horas y se guarda en `sessionStorage`.
- Si alguien copia la clave `anon` del HTML, no puede escribir: RLS lo impide.
- Los datos personales no existen: solo alias y sector.
- El sitio publica un snapshot saneado dos veces: en el cliente y en el servidor.

## 13. Volver atrás

Para desconectar Supabase sin perder nada:

1. Vaciar `url` y `anonKey` en `datos/config.js`.
2. Dejar `auth.modo` en `'local'`.
3. El sitio vuelve a leer el estado guardado en el navegador.

Antes de eso, descargar un respaldo desde **Directiva → Datos**.

## 14. Verificación

La suite del repositorio prueba el almacén y los flujos principales sin necesidad de Supabase:

```bash
node tests/verificar.mjs
```

Comprueba, entre otras cosas, que `sanearParaPublicar` no filtre credenciales, que la cabecera
sea `Bearer <anonKey>`, que el token viaje como `p_token` en el cuerpo y que el descarte por
versión funcione.
