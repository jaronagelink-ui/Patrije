
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Ongeldige hashconfiguratie");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

return new Uint8Array(bytes);
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");

  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    throw new Error("Ongeldige wachtwoordconfiguratie");
  }

  const iterations = Number(parts[1]);
  const salt = hexToBytes(parts[2]);
  const expectedHash = hexToBytes(parts[3]);

  if (
    !Number.isInteger(iterations) ||
    iterations < 100000 ||
    iterations > 1000000 ||
    expectedHash.length !== 32
  ) {
    throw new Error("Ongeldige wachtwoordconfiguratie");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password).buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength,
      ) as ArrayBuffer,
      iterations,
    },
    key,
    256,
  );

  const actualHash = new Uint8Array(derivedBits);

  let difference = 0;

  for (let i = 0; i < expectedHash.length; i++) {
    difference |= actualHash[i] ^ expectedHash[i];
  }

  return difference === 0;
}

function createSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Methode niet toegestaan" }, 405);
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase-configuratie ontbreekt");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // LOGIN
    if (action === "login") {
      const email = Deno.env.get("ADMIN_EMAIL");
      const passwordHash = Deno.env.get("ADMIN_PASSWORD_HASH");

      if (!email || !passwordHash) {
        throw new Error("Beheerdersconfiguratie ontbreekt");
      }

      if (
        typeof body.email !== "string" ||
        typeof body.password !== "string"
      ) {
        return jsonResponse({ error: "Ongeldige inloggegevens" }, 400);
      }

      const emailMatches =
        body.email.trim().toLowerCase() === email.trim().toLowerCase();

      const passwordMatches = await verifyPassword(
        body.password,
        passwordHash,
      );

      if (!emailMatches || !passwordMatches) {
        return jsonResponse({ error: "E-mailadres of wachtwoord onjuist" }, 401);
      }

      const sessionToken = createSessionToken();
      const tokenHash = await sha256(sessionToken);

      const { error } = await supabase
        .from("admin_sessions")
        .insert({ token_hash: tokenHash });

      if (error) throw error;

      return jsonResponse({
        authenticated: true,
        sessionToken,
      });
    }

    // VERIFY / LOGOUT
if (
  action === "verify" ||
  action === "logout" ||
  action === "get_affaire_access" ||
  action === "set_affaire_access" ||
  action === "create_player" ||
  action === "reset_player_access" ||
  action === "get_or_create_player_access_token" || 
  action === "get_admin_affaires" || 
  action === "get_admin_entities" ||
  action === "get_chronicles" ||
  action === "get_admin_players" ||
  action === "get_admin_entity_details" ||
  action === "get_admin_properties" ||
  action === "get_admin_relations" ||
  action === "get_admin_player_access" ||
  action === "get_admin_text_block_access" ||
  action === "create_entity_image_upload" ||
  action === "delete_entity_image" ||
  action === "save_player_characters" ||
  action === "save_entity" ||
  action === "save_entity_property" ||
  action === "save_entity_text_access" ||
  action === "delete_entity_property" ||
  action === "save_entity_relation" ||
  action === "delete_entity_relation" ||
  action === "delete_entity_text" ||
  action === "save_entity_text" ||
  action === "set_player_entity_access"
  
) {
 
// ENTITEIT AANMAKEN OF WIJZIGEN
if (action === "save_entity") {
  const entity = body.entity;

  if (
    !entity ||
    typeof entity.name !== "string" ||
    !entity.name.trim() ||
    typeof entity.type !== "string" ||
    !entity.type.trim() ||
    (entity.subtitle != null && typeof entity.subtitle !== "string") ||
    (entity.image_url != null && typeof entity.image_url !== "string") ||
    (entity.sort_order != null && typeof entity.sort_order !== "number") ||
    (entity.visible_to_all !== undefined &&
      typeof entity.visible_to_all !== "boolean")
  ) {
    return jsonResponse({ error: "Ongeldige entiteit" }, 400);
  }

  const payload = {
    name: entity.name.trim(),
    type: entity.type.trim(),
    subtitle: entity.subtitle || null,
    image_url: entity.image_url || null,
    sort_order: entity.sort_order ?? null,
    visible_to_all: entity.visible_to_all !== false,
    updated_at: new Date().toISOString(),
  };

  if (entity.id) {
    if (typeof entity.id !== "string" || entity.id.startsWith("new-")) {
      return jsonResponse({ error: "Ongeldig entiteit-ID" }, 400);
    }

    const { data, error } = await supabase
      .from("entities")
      .update(payload)
      .eq("id", entity.id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  }

  const { data, error } = await supabase
    .from("entities")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return jsonResponse(data);
}
// ENTITEITTEKST AANMAKEN OF WIJZIGEN
if (action === "save_entity_text") {
  const block = body.block;

  if (
    !block ||
    typeof block.entity_id !== "string" ||
    !block.entity_id ||
    typeof block.content !== "string" ||
    (block.block_type != null && typeof block.block_type !== "string") ||
    (block.published !== undefined && typeof block.published !== "boolean")
  ) {
    return jsonResponse({ error: "Ongeldige entiteitstekst" }, 400);
  }

  const payload = {
    entity_id: block.entity_id,
    block_type: block.block_type || "body",
    content: block.content,
    published: block.published !== false,
  };

  if (block.id) {
    if (typeof block.id !== "string" || block.id.startsWith("new-")) {
      return jsonResponse({ error: "Ongeldig tekstblok-ID" }, 400);
    }

    const { data, error } = await supabase
      .from("entity_text")
      .update(payload)
      .eq("id", block.id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  }

  const { data, error } = await supabase
    .from("entity_text")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return jsonResponse(data);
}

    // EIGENSCHAP VAN EEN ENTITEIT OPSLAAN
if (action === "save_entity_property") {
  const property = body.property;

  if (
    !property ||
    typeof property.entity_id !== "string" ||
    typeof property.property_type !== "string" ||
    typeof property.value !== "string" ||
    (property.visible !== undefined &&
      typeof property.visible !== "boolean")
  ) {
    return jsonResponse({ error: "Ongeldige eigenschap" }, 400);
  }

  const payload = {
    entity_id: property.entity_id,
    property_type: property.property_type,
    value: property.value,
    visible: property.visible !== false,
  };

  if (property.id && !String(property.id).startsWith("new-")) {
    const { data, error } = await supabase
      .from("entity_properties")
      .update(payload)
      .eq("id", property.id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  }

  const { data, error } = await supabase
    .from("entity_properties")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return jsonResponse(data);
}
// EIGENSCHAP VAN EEN ENTITEIT VERWIJDEREN
if (action === "delete_entity_property") {
  const id = body.id;

  if (typeof id !== "string" || !id) {
    return jsonResponse({ error: "Ongeldige eigenschap" }, 400);
  }

  const { data, error } = await supabase
    .from("entity_properties")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return jsonResponse({ error: "Eigenschap niet gevonden" }, 404);
  }

  return jsonResponse({ success: true });
}
    
// RELATIE TUSSEN ENTITEITEN OPSLAAN
if (action === "save_entity_relation") {
  const relation = body.relation;

  if (
    !relation ||
    typeof relation.source_entity_id !== "string" ||
    typeof relation.relation_type !== "string" ||
    typeof relation.target_entity_id !== "string"
  ) {
    return jsonResponse({ error: "Ongeldige relatie" }, 400);
  }

  const payload = {
    source_entity_id: relation.source_entity_id,
    relation_type: relation.relation_type,
    target_entity_id: relation.target_entity_id,
    position: Number.isFinite(Number(relation.position))
      ? Number(relation.position)
      : 0,
    visible: relation.visible !== false,
  };

  if (relation.id && !String(relation.id).startsWith("new-")) {
    const { data, error } = await supabase
      .from("entity_relations")
      .update(payload)
      .eq("id", relation.id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  }

  const { data, error } = await supabase
    .from("entity_relations")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return jsonResponse(data);
}
// RELATIE TUSSEN ENTITEITEN VERWIJDEREN
if (action === "delete_entity_relation") {
  const id = body.id;

  if (typeof id !== "string" || !id) {
    return jsonResponse({ error: "Ongeldige relatie" }, 400);
  }

  const { data, error } = await supabase
    .from("entity_relations")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return jsonResponse({ error: "Relatie niet gevonden" }, 404);
  }

  return jsonResponse({ success: true });
}

// TEKST VAN EEN ENTITEIT VERWIJDEREN
if (action === "delete_entity_text") {
  const id = body.id;

  if (typeof id !== "string" || !id) {
    return jsonResponse({ error: "Ongeldige tekst" }, 400);
  }

  const { data, error } = await supabase
    .from("entity_text")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return jsonResponse({ error: "Tekst niet gevonden" }, 404);
  }

  return jsonResponse({ success: true });
}


    const sessionToken = body.sessionToken;

      if (
        typeof sessionToken !== "string" ||
        !/^[0-9a-f]{64}$/i.test(sessionToken)
      ) {
        return jsonResponse({ error: "Ongeldige sessie" }, 401);
      }

      const tokenHash = await sha256(sessionToken);

      const { data: session, error } = await supabase
        .from("admin_sessions")
        .select("id, revoked_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (error) throw error;

      if (!session || session.revoked_at !== null) {
        return jsonResponse({ error: "Sessie ongeldig" }, 401);
      }

      if (action === "verify") {
        return jsonResponse({ authenticated: true });
      }


// AFBEELDING VAN EEN ENTITEIT VERWIJDEREN
if (action === "delete_entity_image") {
  const { imagePath } = body;

  if (
    typeof imagePath !== "string" ||
    !imagePath.startsWith("entities/") ||
    imagePath.includes("..") ||
    imagePath.includes("\\") ||
    imagePath.startsWith("/") ||
    imagePath.split("/").some((part: string) => !part)
  ) {
    return jsonResponse(
      { error: "Ongeldig afbeeldingspad" },
      400
    );
  }

  const { data, error } = await supabase.storage
    .from("Images")
    .remove([imagePath]);

  if (error) throw error;

  return jsonResponse({
    success: true,
    deleted: data?.length ?? 0,
  });
}


      // TIJDELIJKE UPLOADTOESTEMMING VOOR ENTITEITSAFBEELDINGEN
if (action === "create_entity_image_upload") {
  const { entityId, contentType } = body;

  if (
    typeof entityId !== "string" ||
    !entityId.trim() ||
    typeof contentType !== "string" ||
    !["image/jpeg", "image/png", "image/webp"].includes(contentType)
  ) {
    return jsonResponse({ error: "Ongeldige afbeeldingsgegevens" }, 400);
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[contentType];

  const fileName = `${crypto.randomUUID()}.${extension}`;
  const path = `entities/${entityId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("Images")
    .createSignedUploadUrl(path);

  if (error) throw error;

  return jsonResponse({
    path: data.path,
    token: data.token,
  });
}


  // RELATIES VAN EEN ENTITEIT OPHALEN
  if (action === "get_admin_relations") {
    const { entityId } = body;

    if (typeof entityId !== "string" || !entityId) {
      return jsonResponse(
        { error: "Ongeldig entiteit-ID" },
        400
      );
    }

    const { data, error } = await supabase
      .from("entity_relations")
      .select("id, source_entity_id, relation_type, target_entity_id, position, visible")
      .eq("source_entity_id", entityId)
      .order("position", { ascending: true });

    if (error) throw error;

    return jsonResponse(data || []);
  }


  // BEHEERDERS: TOEGANG VAN SPELERS TOT EEN ENTITEIT OPHALEN
  if (action === "get_admin_player_access") {
    const { entityId } = body;

    if (typeof entityId !== "string" || !entityId) {
      return jsonResponse(
        { error: "Ongeldig entiteit-ID" },
        400
      );
    }

    const { data, error } = await supabase
      .from("player_access")
      .select("id, player_id, entity_id, block_type, property_type, relation_id, available, viewed_at")
      .eq("entity_id", entityId)
      .is("block_type", null)
      .is("property_type", null)
      .is("relation_id", null);

    if (error) throw error;

    return jsonResponse(data || []);
  }



  // BEHEERDERS: TOEGANG TOT TEKSTBLOKKEN OPHALEN
  if (action === "get_admin_text_block_access") {
    const { entityId } = body;

    if (typeof entityId !== "string" || !entityId) {
      return jsonResponse(
        { error: "Ongeldig entiteit-ID" },
        400
      );
    }

    const { data, error } = await supabase
      .from("entity_text_access")
      .select("id, entity_id, entity_text_id, player_id, available")
      .eq("entity_id", entityId);

    if (error) throw error;

    return jsonResponse(data || []);
  }


  
  // EIGENSCHAPPEN VAN EEN ENTITEIT OPHALEN
  if (action === "get_admin_properties") {
    const { entityId } = body;

    if (typeof entityId !== "string" || !entityId) {
      return jsonResponse(
        { error: "Ongeldig entiteit-ID" },
        400
      );
    }

    const { data, error } = await supabase
      .from("entity_properties")
      .select("id, entity_id, property_type, value, visible")
      .eq("entity_id", entityId)
      .order("id", { ascending: true });

    if (error) throw error;

    return jsonResponse(data || []);
  }


  // BEHEERDERSDETAILS VAN EEN ENTITEIT OPHALEN
  if (action === "get_admin_entity_details") {
    const { entityId } = body;

    if (typeof entityId !== "string" || !entityId) {
      return jsonResponse(
        { error: "Ongeldig entiteit-ID" },
        400
      );
    }

    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, type, subtitle, image_url, visible_to_all, sort_order, created_at, updated_at")
      .eq("id", entityId)
      .single();

    if (entityError) throw entityError;

const { data: text, error: textError } = await supabase
  .from("entity_text")
  .select("id, entity_id, block_type, content, published")
  .eq("entity_id", entityId)
  .order("id", { ascending: true });
      if (textError) throw textError;

    return jsonResponse({ entity, text: text || [] });
  }


  // BEHEERDERSLIJST VAN SPELERS OPHALEN
  if (action === "get_admin_players") {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, character_id, access_token, created_at")
      .order("name", { ascending: true });

    if (error) throw error;

    return jsonResponse(data || []);
  }


  // KRONIEKEN OPHALEN
  if (action === "get_chronicles") {
    const { data, error } = await supabase
      .from("entities")
      .select("id, name, type, subtitle, sort_order")
      .eq("type", "kroniek")
      .order("sort_order", { ascending: true, nullsFirst: false });

    if (error) throw error;

    return jsonResponse(data || []);
  }



  // BEHEERDERSLIJST VAN ENTITEITEN OPHALEN
  if (action === "get_admin_entities") {
    const { data, error } = await supabase
      .from("entities")
      .select("id, name, type, subtitle, image_url, visible_to_all, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) throw error;

    return jsonResponse(data || []);
  }


// AFFAIRES OPHALEN VOOR BEHEER
if (action === "get_admin_affaires") {
  const { data, error } = await supabase
    .from("affaires")
    .select("id, name, subtitle, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return jsonResponse(data || []);
}

// TOEGANG TOT TEKSTBLOK VOOR SPELER INSTELLEN
if (action === "save_entity_text_access") {
  const { entityId, entityTextId, playerId, available } = body;

  if (
    typeof entityId !== "string" ||
    !entityId ||
    typeof entityTextId !== "string" ||
    !entityTextId ||
    typeof playerId !== "string" ||
    !playerId ||
    typeof available !== "boolean"
  ) {
    return jsonResponse({ error: "Ongeldige toegangsinstellingen" }, 400);
  }

  const { data, error } = await supabase
    .from("entity_text_access")
    .upsert(
      {
        entity_id: entityId,
        entity_text_id: entityTextId,
        player_id: playerId,
        available,
      },
      { onConflict: "entity_text_id,player_id" }
    )
    .select()
    .single();

  if (error) throw error;

  return jsonResponse(data);
}


// TOEGANG TOT ENTITEIT VOOR SPELER INSTELLEN
if (action === "set_player_entity_access") {
  const { playerId, entityId, available } = body;

  if (
    typeof playerId !== "string" ||
    !playerId ||
    typeof entityId !== "string" ||
    !entityId ||
    typeof available !== "boolean"
  ) {
    return jsonResponse({ error: "Ongeldige toegangsinstellingen" }, 400);
  }

  const { data: existing, error: findError } = await supabase
    .from("player_access")
    .select("id")
    .eq("player_id", playerId)
    .eq("entity_id", entityId)
    .is("block_type", null)
    .is("property_type", null)
    .is("relation_id", null)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error } = await supabase
      .from("player_access")
      .update({ available })
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("player_access")
      .insert({
        player_id: playerId,
        entity_id: entityId,
        available,
      });

    if (error) throw error;
  }

  return jsonResponse({ success: true });
}

// SPELERTOEGANGSTOKEN OPHALEN OF AANMAKEN
if (action === "get_or_create_player_access_token") {
  const playerId = body.playerId;

  if (typeof playerId !== "string" || !playerId) {
    return jsonResponse({ error: "Ongeldige speler" }, 400);
  }

  const { data: player, error: fetchError } = await supabase
    .from("players")
    .select("id, access_token")
    .eq("id", playerId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!player) {
    return jsonResponse({ error: "Speler niet gevonden" }, 404);
  }

  // Bestaat er al een token? Geef dat terug.
  if (player.access_token) {
    return jsonResponse({ token: player.access_token });
  }

  // Maak een nieuw token van 32 willekeurige bytes.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  const token = bytesToHex(bytes);
  const tokenHash = await sha256(token);

  const { error: updateError } = await supabase
    .from("players")
    .update({
      access_token: token,
      access_token_hash: tokenHash,
    })
    .eq("id", playerId);

  if (updateError) throw updateError;

  return jsonResponse({ token });
}

      // TOEGANG VAN EEN SPELER RESETTEN
if (action === "reset_player_access") {
  const playerId = body.playerId;

  if (typeof playerId !== "string" || !playerId) {
    return jsonResponse({ error: "Ongeldige speler" }, 400);
  }

  const { data, error } = await supabase
    .from("players")
    .update({
      access_token: null,
      access_token_hash: null,
    })
    .eq("id", playerId)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return jsonResponse({ error: "Speler niet gevonden" }, 404);
  }

  return jsonResponse({ success: true });
}

      // NIEUWE SPELER AANMAKEN
if (action === "create_player") {
  const name = typeof body.name === "string"
    ? body.name.trim()
    : "";

  const characterId = body.characterId ?? null;

  if (!name || name.length > 80) {
    return jsonResponse({ error: "Ongeldige spelernaam (maximaal 80 tekens)" }, 400);
  }

  if (characterId !== null && typeof characterId !== "string") {
    return jsonResponse({ error: "Ongeldig karakter" }, 400);
  }

  if (characterId !== null) {
    const { data: character, error: characterError } = await supabase
      .from("entities")
      .select("id")
      .eq("id", characterId)
      .eq("type", "karakter")
      .maybeSingle();

    if (characterError) throw characterError;

    if (!character) {
      return jsonResponse({ error: "Karakter niet gevonden" }, 400);
    }
  }

  const { data, error } = await supabase
    .from("players")
    .insert({
      name,
      character_id: characterId,
    })
    .select("id, name, character_id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({
        error: "Deze spelernaam of karakterkoppeling bestaat al."
      }, 409);
    }
    throw error;
  }

  return jsonResponse(data);
}

// KARAKTERKOPPELINGEN OPSLAAN
if (action === "save_player_characters") {
  const assignments = body.assignments;

  if (!Array.isArray(assignments)) {
    return jsonResponse({ error: "Ongeldige spelersgegevens" }, 400);
  }

  const playerIds = assignments.map(item => item?.playerId);

  if (
    assignments.some(item =>
      !item ||
      typeof item.playerId !== "string" ||
      (item.characterId !== null &&
        typeof item.characterId !== "string")
    ) ||
    new Set(playerIds).size !== playerIds.length
  ) {
    return jsonResponse({ error: "Ongeldige karakterkoppelingen" }, 400);
  }

  const characterIds = assignments
    .map(item => item.characterId)
    .filter(id => id !== null);

  if (new Set(characterIds).size !== characterIds.length) {
    return jsonResponse({
      error: "Een karakter kan maar aan één speler gekoppeld zijn."
    }, 400);
  }

  if (playerIds.length > 0) {
    const { data: existingPlayers, error: playersError } = await supabase
      .from("players")
      .select("id")
      .in("id", playerIds);

    if (playersError) throw playersError;

    if (existingPlayers.length !== playerIds.length) {
      return jsonResponse({ error: "Een of meer spelers bestaan niet." }, 400);
    }
  }

  if (characterIds.length > 0) {
    const { data: existingCharacters, error: charactersError } = await supabase
      .from("entities")
      .select("id")
      .eq("type", "karakter")
      .in("id", characterIds);

    if (charactersError) throw charactersError;

    if (existingCharacters.length !== characterIds.length) {
      return jsonResponse({
        error: "Een of meer geselecteerde karakters bestaan niet."
      }, 400);
    }
  }

  for (const assignment of assignments) {
    const { error } = await supabase
      .from("players")
      .update({ character_id: assignment.characterId })
      .eq("id", assignment.playerId);

    if (error) {
      if (error.code === "23505") {
        return jsonResponse({
          error: "Dit karakter is inmiddels aan een andere speler gekoppeld."
        }, 409);
      }
      throw error;
    }
  }

  return jsonResponse({ success: true });
}

if (action === "get_affaire_access") {
  const affaireId = body.affaireId;

  if (typeof affaireId !== "string") {
    return jsonResponse({ error: "Ongeldige Affaire" }, 400);
  }

  const { data, error } = await supabase
    .from("affaire_access")
    .select("id, player_id, affaire_id, available")
    .eq("affaire_id", affaireId);

  if (error) throw error;

  return jsonResponse(data || []);
}

if (action === "set_affaire_access") {
  const { playerId, affaireId, available } = body;

  if (
    typeof playerId !== "string" ||
    typeof affaireId !== "string" ||
    typeof available !== "boolean"
  ) {
    return jsonResponse({ error: "Ongeldige toegangsgegevens" }, 400);
  }

  if (available) {
    const { error } = await supabase
      .from("affaire_access")
      .delete()
      .eq("player_id", playerId)
      .eq("affaire_id", affaireId);

    if (error) throw error;

    return jsonResponse({ success: true });
  }

  const { data: existing, error: findError } = await supabase
    .from("affaire_access")
    .select("id")
    .eq("player_id", playerId)
    .eq("affaire_id", affaireId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error } = await supabase
      .from("affaire_access")
      .update({ available: false })
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("affaire_access")
      .insert({
        player_id: playerId,
        affaire_id: affaireId,
        available: false,
      });

    if (error) throw error;
  }

  return jsonResponse({ success: true });
}
 
const { error: logoutError } = await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", session.id);

      if (logoutError) throw logoutError;

      return jsonResponse({ authenticated: false });
    }

    return jsonResponse({ error: "Onbekende actie" }, 400);
  } catch (error) {
    console.error("Admin API fout:", error);
    return jsonResponse({ error: "Interne serverfout" }, 500);
  }
});
