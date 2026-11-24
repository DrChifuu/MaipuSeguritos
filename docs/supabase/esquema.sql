-- ============================================================================
-- MAIPO VIGÍA · ESQUEMA DE REFERENCIA PARA SUPABASE
-- Fase 2. Revisar antes de publicar. Ejecutar completo en el SQL Editor.
--
-- Idea general:
--   · Las tablas normalizadas (puntos, tramos, lecturas) son la fuente.
--   · mv_estado_snapshot guarda el último tablero publicado, con la misma
--     forma que datos/semilla.js, para que el sitio lo lea sin transformar.
--   · El público solo lee. Todo lo que escribe pasa por funciones
--     SECURITY DEFINER que revisan una sesión de tarjeta.
-- ============================================================================

create extension if not exists pgcrypto;

-- Secreto del proyecto, para firmar tarjetas. No se entrega a nadie.
create table if not exists mv_config (
  clave text primary key,
  valor text not null
);
insert into mv_config (clave, valor)
values ('secreto', encode(gen_random_bytes(32), 'hex'))
on conflict (clave) do nothing;

-- ---------------------------------------------------------------- 1. PUNTOS
create table if not exists mv_puntos (
  id            text primary key,
  station_id    text unique,
  nombre        text not null,
  quebrada      text,
  tiene_sensor  boolean not null default false,
  estado_sensor text,
  orden         int not null default 0,
  serie_24h     jsonb not null default '[]'::jsonb,
  acciones      jsonb not null default '[]'::jsonb,
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. CAMINOS
create table if not exists mv_tramos (
  id     text primary key,
  nombre text not null,
  orden  int not null default 0
);

create table if not exists mv_tramo_estado (
  id         bigserial primary key,
  tramo_id   text not null references mv_tramos(id) on delete cascade,
  estado     text not null check (estado in ('verde', 'ambar', 'rojo', 'sindato')),
  fuente     text not null,
  nota       text,
  hora       timestamptz not null default now(),
  autor      text,
  creado_en  timestamptz not null default now()
);
create index if not exists mv_tramo_estado_ultimo on mv_tramo_estado (tramo_id, creado_en desc);

create or replace view mv_tramo_ultimo as
select distinct on (tramo_id)
  tramo_id, estado, fuente, nota, hora, autor, creado_en
from mv_tramo_estado
order by tramo_id, creado_en desc;

-- ---------------------------------------------------------- 3. OBSERVADORES
create table if not exists mv_observadores (
  id             text primary key,
  alias          text not null,
  sector         text,
  sector_id      text,
  rol            text not null check (rol in ('observador', 'directiva')),
  estado         text not null default 'Acreditado' check (estado in ('Acreditado', 'Suspendido')),
  tarjeta_hash   text not null,          -- hmac del código, nunca el código
  pin_hash       text not null,          -- bcrypt, nunca la clave
  motivo_baja    text,
  ultima_lectura timestamptz,
  creado_en      timestamptz not null default now()
);
create unique index if not exists mv_observadores_tarjeta on mv_observadores (tarjeta_hash);

-- ------------------------------------------------------------- 4. LECTURAS
create table if not exists mv_lecturas (
  id                 text primary key,
  punto_id           text not null references mv_puntos(id) on delete restrict,
  mm                 numeric(6, 1) check (mm is null or (mm >= 0 and mm <= 300)),  -- null = «sin dato»
  medida_en          timestamptz not null,
  origen             text not null,
  instrumento        text,
  autor_id           text,
  autor_alias        text,
  estado             text not null default 'En revisión'
                     check (estado in ('En revisión', 'Validada', 'Rechazada', 'Corregida', 'Anulada')),
  oficial            boolean not null default false,
  foto               text,
  nota               text,
  verificado_por     text,
  verificado_en      timestamptz,
  creado_en          timestamptz not null default now()
);
create index if not exists mv_lecturas_punto_fecha on mv_lecturas (punto_id, medida_en desc);
create index if not exists mv_lecturas_pendientes on mv_lecturas (estado) where estado = 'En revisión';

-- --------------------------------------------------------------- 5. AVISOS
create table if not exists mv_avisos (
  id         text primary key,
  tramo_id   text references mv_tramos(id) on delete set null,
  tipo       text not null,
  nota       text,
  foto       text,
  estado     text not null default 'En revisión'
             check (estado in ('En revisión', 'Validada', 'Rechazada')),
  creado_en  timestamptz not null default now()
);

-- ------------------------------------------------------------- 6. ARCHIVOS
create table if not exists mv_archivos (
  id           text primary key,
  nombre       text not null,
  formato      text not null,
  filas        int,
  periodo      text,
  resumen      jsonb,
  por_punto    jsonb,
  por_hora     jsonb,
  filas_datos  jsonb,
  publicado    boolean not null default false,
  publicado_en timestamptz,
  creado_en    timestamptz not null default now()
);

-- ------------------------------------------------- 7. SESIONES DE TARJETA
create table if not exists mv_sesiones (
  token          uuid primary key default gen_random_uuid(),
  observador_id  text not null references mv_observadores(id) on delete cascade,
  expira_en      timestamptz not null default now() + interval '8 hours',
  creado_en      timestamptz not null default now()
);

-- ------------------------------------------- 8. TABLERO PUBLICADO (SNAPSHOT)
create table if not exists mv_estado_snapshot (
  id             int primary key default 1 check (id = 1),
  estado         jsonb not null,
  actualizado_en timestamptz not null default now()
);

-- ============================================================================
-- SEGURIDAD: el público lee; nadie escribe directo.
-- ============================================================================
alter table mv_puntos            enable row level security;
alter table mv_tramos            enable row level security;
alter table mv_tramo_estado      enable row level security;
alter table mv_observadores      enable row level security;
alter table mv_lecturas          enable row level security;
alter table mv_avisos            enable row level security;
alter table mv_archivos          enable row level security;
alter table mv_sesiones          enable row level security;
alter table mv_estado_snapshot   enable row level security;
alter table mv_config            enable row level security;

drop policy if exists mv_leer_puntos on mv_puntos;
create policy mv_leer_puntos on mv_puntos for select using (true);

drop policy if exists mv_leer_tramos on mv_tramos;
create policy mv_leer_tramos on mv_tramos for select using (true);

drop policy if exists mv_leer_estado_tramos on mv_tramo_estado;
create policy mv_leer_estado_tramos on mv_tramo_estado for select using (true);

drop policy if exists mv_leer_lecturas on mv_lecturas;
create policy mv_leer_lecturas on mv_lecturas for select using (estado = 'Validada' or oficial = true);

drop policy if exists mv_leer_archivos on mv_archivos;
create policy mv_leer_archivos on mv_archivos for select using (publicado = true);

drop policy if exists mv_leer_snapshot on mv_estado_snapshot;
create policy mv_leer_snapshot on mv_estado_snapshot for select using (true);

-- mv_config, mv_observadores y mv_sesiones quedan sin políticas:
-- solo las funciones SECURITY DEFINER pueden tocarlas.

-- ============================================================================
-- FUNCIONES
-- ============================================================================
create or replace function mv_hash_tarjeta(p_codigo text)
returns text
language sql
security definer
set search_path = public
as $$
  select encode(hmac(p_codigo, (select valor from mv_config where clave = 'secreto'), 'sha256'), 'hex');
$$;

-- Entra con tarjeta y clave. Devuelve el observador y un token de 8 horas.
create or replace function mv_entrar(p_codigo text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obs   mv_observadores;
  v_token uuid;
begin
  -- No se acumulan tokens muertos: se limpian al entrar.
  delete from mv_sesiones where expira_en <= now();

  select * into v_obs
  from mv_observadores
  where tarjeta_hash = mv_hash_tarjeta(trim(p_codigo))
    and estado = 'Acreditado'
  limit 1;

  -- Mismo mensaje si no existe la tarjeta o si la clave no calza.
  if v_obs.id is null or crypt(p_pin, v_obs.pin_hash) <> v_obs.pin_hash then
    return jsonb_build_object('ok', false);
  end if;

  insert into mv_sesiones (observador_id) values (v_obs.id)
  returning token into v_token;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'observador', jsonb_build_object(
      'id', v_obs.id,
      'alias', v_obs.alias,
      'sector', v_obs.sector,
      'sector_id', v_obs.sector_id,
      'rol', v_obs.rol
    )
  );
end;
$$;

create or replace function mv_sesion(p_token uuid)
returns table (observador_id text, rol text, alias text)
language sql
security definer
set search_path = public
as $$
  select s.observador_id, o.rol, o.alias
  from mv_sesiones s
  join mv_observadores o on o.id = s.observador_id
  where s.token = p_token
    and s.expira_en > now()
    and o.estado = 'Acreditado';
$$;

-- Registra una lectura. El observador entra "En revisión"; la directiva
-- puede entrar validada con p_oficial = true.
create or replace function mv_registrar_lectura(
  p_token uuid,
  p_punto text,
  p_mm numeric,
  p_medida_en timestamptz,
  p_origen text,
  p_nota text default null,
  p_oficial boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses  record;
  v_id   text;
begin
  select * into v_ses from mv_sesion(p_token) limit 1;
  if v_ses.observador_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sesion');
  end if;
  if p_oficial and v_ses.rol <> 'directiva' then
    return jsonb_build_object('ok', false, 'motivo', 'permiso');
  end if;

  v_id := 'MV-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4);

  insert into mv_lecturas (id, punto_id, mm, medida_en, origen, autor_id, autor_alias, estado, oficial, nota)
  values (
    v_id, p_punto, p_mm, p_medida_en, p_origen, v_ses.observador_id, v_ses.alias,
    case when p_oficial then 'Validada' else 'En revisión' end,
    p_oficial, p_nota
  );

  update mv_observadores set ultima_lectura = now() where id = v_ses.observador_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function mv_confirmar_tramo(
  p_token uuid,
  p_tramo text,
  p_estado text,
  p_fuente text,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses record;
begin
  select * into v_ses from mv_sesion(p_token) limit 1;
  if v_ses.observador_id is null or v_ses.rol <> 'directiva' then
    return jsonb_build_object('ok', false, 'motivo', 'permiso');
  end if;

  insert into mv_tramo_estado (tramo_id, estado, fuente, nota, autor)
  values (p_tramo, p_estado, p_fuente, p_nota, v_ses.alias);

  return jsonb_build_object('ok', true);
end;
$$;

-- Publica el tablero completo. Solo la directiva.
create or replace function mv_guardar_estado(p_token uuid, p_estado jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses record;
begin
  select * into v_ses from mv_sesion(p_token) limit 1;
  if v_ses.observador_id is null or v_ses.rol <> 'directiva' then
    return jsonb_build_object('ok', false, 'motivo', 'permiso');
  end if;

  if p_estado is null or jsonb_typeof(p_estado) <> 'object' then
    return jsonb_build_object('ok', false, 'motivo', 'formato');
  end if;

  -- El snapshot público no lleva sesión ni credenciales de tarjetas.
  p_estado := p_estado - 'session' - 'loginAttempts' - 'lockoutUntil' - '_version';

  if jsonb_typeof(p_estado -> 'observers') = 'array' then
    p_estado := jsonb_set(
      p_estado,
      '{observers}',
      coalesce((
        select jsonb_agg(o - 'card' - 'pin')
        from jsonb_array_elements(p_estado -> 'observers') as o
      ), '[]'::jsonb)
    );
  end if;

  insert into mv_estado_snapshot (id, estado, actualizado_en)
  values (1, p_estado, now())
  on conflict (id) do update set estado = excluded.estado, actualizado_en = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- Lo que lee el sitio público: el último tablero publicado.
create or replace function mv_estado_publico()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select estado from mv_estado_snapshot where id = 1),
    '{}'::jsonb
  );
$$;

-- Permisos de ejecución: el sitio usa la clave anon.
revoke all on function mv_hash_tarjeta(text) from public;
grant execute on function mv_entrar(text, text) to anon, authenticated;
grant execute on function mv_sesion(uuid) to anon, authenticated;
grant execute on function mv_registrar_lectura(uuid, text, numeric, timestamptz, text, text, boolean) to anon, authenticated;
grant execute on function mv_confirmar_tramo(uuid, text, text, text, text) to anon, authenticated;
grant execute on function mv_guardar_estado(uuid, jsonb) to anon, authenticated;
grant execute on function mv_estado_publico() to anon, authenticated;

-- ============================================================================
-- ADMINISTRACIÓN DE TARJETAS (solo directiva)
-- ============================================================================

-- Cierra la sesión de una tarjeta.
create or replace function mv_salir(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from mv_sesiones where token = p_token;
  return jsonb_build_object('ok', true);
end;
$$;

-- Crea una tarjeta nueva. Solo la directiva.
create or replace function mv_crear_observador(
  p_token uuid,
  p_alias text,
  p_sector text,
  p_sector_id text,
  p_codigo text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses record;
  v_id  text;
begin
  select * into v_ses from mv_sesion(p_token) limit 1;
  if v_ses.observador_id is null or v_ses.rol <> 'directiva' then
    return jsonb_build_object('ok', false, 'motivo', 'permiso');
  end if;

  if coalesce(trim(p_alias), '') = ''
     or coalesce(trim(p_codigo), '') = ''
     or coalesce(trim(p_pin), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;

  if exists (
    select 1 from mv_observadores
    where tarjeta_hash = mv_hash_tarjeta(trim(p_codigo))
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'tarjeta-duplicada');
  end if;

  v_id := 'OBS-' || upper(substr(md5(random()::text), 1, 6));

  insert into mv_observadores (
    id, alias, sector, sector_id, rol, estado, tarjeta_hash, pin_hash
  ) values (
    v_id, trim(p_alias), p_sector, p_sector_id, 'observador', 'Acreditado',
    mv_hash_tarjeta(trim(p_codigo)), crypt(p_pin, gen_salt('bf'))
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Cambia la clave y, si viene, el código de una tarjeta. Solo la directiva.
create or replace function mv_cambiar_pin_observador(
  p_token uuid,
  p_obs_id text,
  p_nuevo_pin text,
  p_nuevo_codigo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses record;
begin
  select * into v_ses from mv_sesion(p_token) limit 1;
  if v_ses.observador_id is null or v_ses.rol <> 'directiva' then
    return jsonb_build_object('ok', false, 'motivo', 'permiso');
  end if;

  if coalesce(trim(p_nuevo_pin), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'datos');
  end if;

  if not exists (select 1 from mv_observadores where id = p_obs_id) then
    return jsonb_build_object('ok', false, 'motivo', 'no-existe');
  end if;

  if coalesce(trim(p_nuevo_codigo), '') <> '' then
    if exists (
      select 1 from mv_observadores
      where tarjeta_hash = mv_hash_tarjeta(trim(p_nuevo_codigo))
        and id <> p_obs_id
    ) then
      return jsonb_build_object('ok', false, 'motivo', 'tarjeta-duplicada');
    end if;

    update mv_observadores
    set pin_hash = crypt(p_nuevo_pin, gen_salt('bf')),
        tarjeta_hash = mv_hash_tarjeta(trim(p_nuevo_codigo))
    where id = p_obs_id;
  else
    update mv_observadores
    set pin_hash = crypt(p_nuevo_pin, gen_salt('bf'))
    where id = p_obs_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Suspende o reactiva una tarjeta. Solo la directiva.
create or replace function mv_cambiar_estado_observador(
  p_token uuid,
  p_obs_id text,
  p_estado text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses record;
begin
  select * into v_ses from mv_sesion(p_token) limit 1;
  if v_ses.observador_id is null or v_ses.rol <> 'directiva' then
    return jsonb_build_object('ok', false, 'motivo', 'permiso');
  end if;

  if p_estado is null or p_estado not in ('Acreditado', 'Suspendido') then
    return jsonb_build_object('ok', false, 'motivo', 'estado');
  end if;

  update mv_observadores
  set estado = p_estado,
      motivo_baja = case when p_estado = 'Suspendido' then p_motivo else null end
  where id = p_obs_id;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no-existe');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function mv_salir(uuid) to anon, authenticated;
grant execute on function mv_crear_observador(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function mv_cambiar_pin_observador(uuid, text, text, text) to anon, authenticated;
grant execute on function mv_cambiar_estado_observador(uuid, text, text, text) to anon, authenticated;

-- ============================================================================
-- DATOS INICIALES (los mismos seis puntos de la semilla)
-- ============================================================================
insert into mv_puntos (id, station_id, nombre, quebrada, tiene_sensor, estado_sensor, orden) values
  ('san-alfonso',   'SJM-SANALFONSO-01', 'San Alfonso',   'Estero San Alfonso', true,  'Equipo LoRa activo · batería 84 %', 1),
  ('el-melocoton',  'SJM-ELMELOCOTON-01','El Melocotón',  null,                 true,  'Equipo LoRa activo · batería 78 %', 2),
  ('el-manzano',    'SJM-ELMANZANO-01',  'El Manzano',    null,                 true,  'Equipo LoRa activo · batería 91 %', 3),
  ('el-canelo',     'SJM-ELCANELO-01',   'El Canelo',     null,                 true,  'Equipo LoRa activo · batería 72 %', 4),
  ('san-gabriel',   'SJM-SANGABRIEL-01', 'San Gabriel',   null,                 true,  'Sin transmisión desde ayer 18:00',  5),
  ('plaza-de-armas','SJM-PLAZA-01',      'Plaza de Armas',null,                 false, 'Equipo no instalado todavía',       6)
on conflict (id) do nothing;

insert into mv_tramos (id, nombre, orden) values
  ('plaza-de-armas', 'Plaza de Armas', 1),
  ('el-canelo',      'El Canelo', 2),
  ('el-manzano',     'El Manzano', 3),
  ('el-melocoton',   'El Melocotón', 4),
  ('san-alfonso',    'San Alfonso', 5),
  ('san-gabriel',    'San Gabriel', 6)
on conflict (id) do nothing;

-- Observadores de ejemplo. Cambiar las claves antes de publicar.
-- El código va hasheado con el secreto del proyecto; la clave, con bcrypt.
insert into mv_observadores (id, alias, sector, sector_id, rol, estado, tarjeta_hash, pin_hash) values
  ('OBS-01','Observador San Alfonso','San Alfonso','san-alfonso','observador','Acreditado',
    mv_hash_tarjeta('10042042'), crypt('1234', gen_salt('bf'))),
  ('OBS-02','Observadora El Manzano','El Manzano','el-manzano','observador','Acreditado',
    mv_hash_tarjeta('10042051'), crypt('2222', gen_salt('bf'))),
  ('OBS-03','Directiva','Plaza de Armas','plaza-de-armas','directiva','Acreditado',
    mv_hash_tarjeta('90000001'), crypt('9999', gen_salt('bf')))
on conflict (id) do nothing;
