-- Res Politica: beheerlaag
-- 1. Globale zichtbaarheid van entities.
alter table public.entities
  add column if not exists visible_to_all boolean not null default true;

-- 2. Zorg dat bestaande entities zichtbaar blijven zoals nu.
update public.entities
set visible_to_all = true
where visible_to_all is null;

-- 3. ADMIN RLS
-- LET OP: deze policies zijn tijdelijk voor de huidige development-opzet.
-- De huidige frontend gebruikt de anon/publishable Supabase-key.
-- Voor productie moet beheer achter echte server-side authenticatie/RPC/Edge Functions.

create policy "dev_admin_select_entities"
on public.entities
for select
TO anon
using (true);

create policy "dev_admin_insert_entities"
on public.entities
for insert
TO anon
with check (true);

create policy "dev_admin_update_entities"
on public.entities
for update
TO anon
using (true)
with check (true);

create policy "dev_admin_select_players"
on public.players
for select
TO anon
using (true);

create policy "dev_admin_select_entity_text"
on public.entity_text
for select
TO anon
using (true);

create policy "dev_admin_insert_entity_text"
on public.entity_text
for insert
TO anon
with check (true);

create policy "dev_admin_update_entity_text"
on public.entity_text
for update
TO anon
using (true)
with check (true);

create policy "dev_admin_delete_entity_text"
on public.entity_text
for delete
TO anon
using (true);

create policy "dev_admin_select_entity_properties"
on public.entity_properties
for select
TO anon
using (true);

create policy "dev_admin_insert_entity_properties"
on public.entity_properties
for insert
TO anon
with check (true);

create policy "dev_admin_update_entity_properties"
on public.entity_properties
for update
TO anon
using (true)
with check (true);

create policy "dev_admin_delete_entity_properties"
on public.entity_properties
for delete
TO anon
using (true);

create policy "dev_admin_select_entity_relations"
on public.entity_relations
for select
TO anon
using (true);

create policy "dev_admin_insert_entity_relations"
on public.entity_relations
for insert
TO anon
with check (true);

create policy "dev_admin_update_entity_relations"
on public.entity_relations
for update
TO anon
using (true)
with check (true);

create policy "dev_admin_delete_entity_relations"
on public.entity_relations
for delete
TO anon
using (true);

create policy "dev_admin_select_player_access"
on public.player_access
for select
TO anon
using (true);

create policy "dev_admin_insert_player_access"
on public.player_access
for insert
TO anon
with check (true);

create policy "dev_admin_update_player_access"
on public.player_access
for update
TO anon
using (true)
with check (true);

-- PLAYER-ZICHT: globale entities mogen door spelers gelezen worden.
-- De bestaande player_access-regels bepalen uitzonderingen.
create policy "dev_player_select_global_entities"
on public.entities
for select
TO anon
using (visible_to_all = true);
