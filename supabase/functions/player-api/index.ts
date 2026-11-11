
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

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Ongeldig sessietoken");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signSessionPayload(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
}

async function verifySignedSessionToken(
  token: string,
  secret: string,
): Promise<{ playerId: string; characterId: string | null; expiresAt: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, encodedSignature] = parts;
    const payloadBytes = base64UrlToBytes(encodedPayload);
    const signature = base64UrlToBytes(encodedSignature);
    const expected = await signSessionPayload(encodedPayload, secret);

    if (signature.length !== expected.length) return null;

    let difference = 0;
    for (let i = 0; i < expected.length; i++) {
      difference |= signature[i] ^ expected[i];
    }
    if (difference !== 0) return null;

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (
      typeof payload.playerId !== "string" ||
      !payload.playerId ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000) ||
      (payload.characterId !== null && typeof payload.characterId !== "string")
    ) {
      return null;
    }

    return {
      playerId: payload.playerId,
      characterId: payload.characterId,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
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
    const { sessionToken, action, ...params } = body;

    if (
      typeof sessionToken !== "string" ||
      sessionToken.length < 20 ||
      sessionToken.length > 2048 ||
      typeof action !== "string"
    ) {
      return jsonResponse({ error: "Ongeldige aanvraag" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const signingSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, signingSecret);

    // Nieuwe sessies worden cryptografisch gecontroleerd, zonder databasequery.
    const signedSession = await verifySignedSessionToken(
      sessionToken,
      signingSecret,
    );

    let playerId: string;

    if (signedSession) {
      playerId = signedSession.playerId;
    } else if (/^[0-9a-f]{64}$/i.test(sessionToken)) {
      // Tijdelijke compatibiliteit met sessies die vóór deze wijziging zijn aangemaakt.
      const tokenHash = await sha256(sessionToken);
      const { data: session, error: sessionError } = await supabase
        .from("player_sessions")
        .select("player_id, expires_at, revoked_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (sessionError) throw sessionError;

      if (
        !session ||
        session.revoked_at !== null ||
        new Date(session.expires_at).getTime() <= Date.now()
      ) {
        return jsonResponse({ error: "Sessie verlopen of ongeldig" }, 401);
      }

      playerId = session.player_id;
    } else {
      return jsonResponse({ error: "Sessie verlopen of ongeldig" }, 401);
    }

    // Hulpfunctie: controleer of de speler toegang heeft tot een entiteit.

async function canAccessEntity(entityId: string): Promise<boolean> {
  const { data: entity, error } = await supabase
    .from("entities")
    .select("id, visible_to_all")
    .eq("id", entityId)
    .maybeSingle();

  if (error) throw error;
  if (!entity) return false;

  const { data: override, error: accessError } = await supabase
    .from("player_access")
    .select("available")
    .eq("player_id", playerId)
    .eq("entity_id", entityId)
    .is("block_type", null)
    .is("property_type", null)
    .is("relation_id", null)
    .maybeSingle();

  if (accessError) throw accessError;

  if (entity.visible_to_all === true) {
    return override?.available !== false;
  }

  return override?.available === true;
}

    // Hulpfunctie: controleer of de speler aan een Affaire deelneemt.
async function canAccessAffaire(affaireId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("affaire_access")
    .select("available")
    .eq("player_id", playerId)
    .eq("affaire_id", affaireId)
    .maybeSingle();

  if (error) throw error;

  // Geen expliciete regel betekent: openbaar toegankelijk.
  if (!data) return true;

  return data.available === true;
}


    switch (action) {
      case "get_character": {
        const { data, error } = await supabase
          .from("players")
          .select(`
            character_id,
            entities (
              id, type, name, subtitle, image_url
            )
          `)
          .eq("id", playerId)
          .single();

        if (error) throw error;
        return jsonResponse(data?.entities ?? null);
      }


case "get_entities": {
  const { data: entities, error } = await supabase
    .from("entities")
    .select("id, type, name, subtitle, image_url, visible_to_all");

  if (error) throw error;

  const { data: overrides, error: accessError } = await supabase
    .from("player_access")
    .select("entity_id, available, viewed_at")
    .eq("player_id", playerId)
    .not("entity_id", "is", null)
    .is("block_type", null)
    .is("property_type", null)
    .is("relation_id", null);

  if (accessError) throw accessError;

  const overrideMap = new Map(
    (overrides ?? []).map((row) => [row.entity_id, row]),
  );

  const result = (entities ?? [])
    .filter((entity) => {
      const override = overrideMap.get(entity.id);

      if (entity.visible_to_all === true) {
        return override?.available !== false;
      }

      return override?.available === true;
    })
    .map((entity) => ({
      entity_id: entity.id,
      block_type: null,
      available: true,
      viewed_at: overrideMap.get(entity.id)?.viewed_at ?? null,
      entities: entity,
    }));

  return jsonResponse(result);
}

      case "get_entity_text": {
        const { entityId } = params;

        if (typeof entityId !== "string") {
          return jsonResponse({ error: "Ongeldige entiteit" }, 400);
        }

        // Toegang, tekstblokken en blokregels gelijktijdig ophalen.
        const [
          { data: entity, error: entityError },
          { data: override, error: accessError },
          { data: blocks, error: blocksError },
          { data: rules, error: rulesError },
        ] = await Promise.all([
          supabase
            .from("entities")
            .select("id, visible_to_all")
            .eq("id", entityId)
            .maybeSingle(),

          supabase
            .from("player_access")
            .select("available")
            .eq("player_id", playerId)
            .eq("entity_id", entityId)
            .is("block_type", null)
            .is("property_type", null)
            .is("relation_id", null)
            .maybeSingle(),

          supabase
            .from("entity_text")
            .select("id, entity_id, block_type, content, published")
            .eq("entity_id", entityId)
            .eq("published", true),

          supabase
            .from("entity_text_access")
            .select("entity_text_id, player_id, available")
            .eq("entity_id", entityId),
        ]);

        if (entityError) throw entityError;
        if (accessError) throw accessError;
        if (blocksError) throw blocksError;
        if (rulesError) throw rulesError;

        if (!entity) {
          return jsonResponse({ error: "Geen toegang" }, 403);
        }

        const hasEntityAccess = entity.visible_to_all === true
          ? override?.available !== false
          : override?.available === true;

        if (!hasEntityAccess) {
          return jsonResponse({ error: "Geen toegang" }, 403);
        }

        const rulesByBlock = new Map<string, typeof rules>();

        for (const rule of rules ?? []) {
          const existing = rulesByBlock.get(rule.entity_text_id) ?? [];
          existing.push(rule);
          rulesByBlock.set(rule.entity_text_id, existing);
        }

        const visibleBlocks = (blocks ?? []).filter((block) => {
          const blockRules = rulesByBlock.get(block.id);

          if (!blockRules?.length) return true;

          return blockRules.some(
            (rule) =>
              rule.player_id === playerId &&
              rule.available === true,
          );
        });

        return jsonResponse(visibleBlocks);
      }

case "get_curiosa": {
  const { data, error } = await supabase
    .from("player_curiosa")
    .select(`
      entity_id,
      entities (
        id, type, name, subtitle, image_url
      )
    `)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Controleer per bewaard item of de speler nog toegang heeft.
  const checkedCuriosa = await Promise.all(
    (data ?? []).map(async (item) => ({
      item,
      accessible: item.entities?.id
        ? await canAccessEntity(item.entities.id)
        : false,
    }))
  );

  // Toon uitsluitend toegankelijke entiteiten.
  const visibleCuriosa = checkedCuriosa
    .filter(({ accessible }) => accessible)
    .map(({ item }) => item);

  return jsonResponse(visibleCuriosa);
}


      case "add_curiosa": {
        const { entityId } = params;

        if (
          typeof entityId !== "string" ||
          !(await canAccessEntity(entityId))
        ) {
          return jsonResponse({ error: "Geen toegang tot entiteit" }, 403);
        }

        const { error } = await supabase
          .from("player_curiosa")
          .upsert(
            { player_id: playerId, entity_id: entityId },
            { onConflict: "player_id,entity_id", ignoreDuplicates: true },
          );

        if (error) throw error;
        return jsonResponse({ success: true });
      }

      case "remove_curiosa": {
        const { entityId } = params;

        if (typeof entityId !== "string") {
          return jsonResponse({ error: "Ongeldige entiteit" }, 400);
        }

        const { error } = await supabase
          .from("player_curiosa")
          .delete()
          .eq("player_id", playerId)
          .eq("entity_id", entityId);

        if (error) throw error;
        return jsonResponse({ success: true });
      }

      case "mark_entity_viewed": {
        const { entityId } = params;

        if (
          typeof entityId !== "string" ||
          !(await canAccessEntity(entityId))
        ) {
          return jsonResponse({ error: "Geen toegang" }, 403);
        }

        const { error } = await supabase
          .from("player_access")
          .update({ viewed_at: new Date().toISOString() })
          .eq("player_id", playerId)
          .eq("entity_id", entityId);

        if (error) throw error;
        return jsonResponse({ success: true });
      }


case "get_player_affaires": {
  const [
    { data: affaires, error: affairesError },
    { data: accessRules, error: accessError },
    { data: playerAffaires, error: playerAffairesError },
  ] = await Promise.all([
    supabase
      .from("affaires")
      .select(`
        id,
        name,
        subtitle,
        created_at,
        updated_at
      `),

    supabase
      .from("affaire_access")
      .select("affaire_id, available")
      .eq("player_id", playerId),

    supabase
      .from("player_affaires")
      .select("affaire_id, viewed_at")
      .eq("player_id", playerId),
  ]);

  if (affairesError) throw affairesError;
  if (accessError) throw accessError;
  if (playerAffairesError) throw playerAffairesError;

  // Verzamel de Affaires waarvoor deze speler geen toegang heeft.
  const deniedAffaires = new Set(
    (accessRules ?? [])
      .filter((rule) => rule.available === false)
      .map((rule) => rule.affaire_id)
  );

  // Bewaar persoonlijke gegevens per Affaire.
  const viewedByAffaire = new Map(
    (playerAffaires ?? []).map((row) => [
      row.affaire_id,
      row.viewed_at,
    ])
  );

// Toon alleen gekoppelde én toegankelijke Affaires.
const playerAffaireIds = new Set(
  (playerAffaires ?? []).map(row => row.affaire_id)
);

const result = (affaires ?? [])
  .filter(affaire =>
    playerAffaireIds.has(affaire.id) &&
    !deniedAffaires.has(affaire.id)
  )
  .map(affaire => ({
    ...affaire,
    viewed_at: viewedByAffaire.get(affaire.id) ?? null,
  }))
  .sort((a, b) =>
    new Date(b.updated_at ?? 0).getTime() -
    new Date(a.updated_at ?? 0).getTime()
  );

return jsonResponse(result);
}

case "mark_affaire_viewed": {
  const affaireId = body.affaireId;

  if (typeof affaireId !== "string" || !affaireId) {
    return jsonResponse({ error: "Ongeldige affaire" }, 400);
  }

  // Controleer of deze speler toegang heeft tot de affaire.
  const [
    { data: affaire, error: affaireError },
    { data: accessRule, error: accessError },
  ] = await Promise.all([
    supabase
      .from("player_affaires")
      .select("affaire_id")
      .eq("player_id", playerId)
      .eq("affaire_id", affaireId)
      .maybeSingle(),

    supabase
      .from("affaire_access")
      .select("available")
      .eq("player_id", playerId)
      .eq("affaire_id", affaireId)
      .maybeSingle(),
  ]);

  if (affaireError) throw affaireError;
  if (accessError) throw accessError;

  if (!affaire || accessRule?.available === false) {
    return jsonResponse({ error: "Geen toegang tot deze affaire" }, 403);
  }

  const { error } = await supabase
    .from("player_affaires")
    .update({ viewed_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("affaire_id", affaireId);

  if (error) throw error;

  return jsonResponse({ success: true });
}


case "create_player_affaire": {
  const { name, subtitle } = params;

  // Controleer de invoer.
  if (
    typeof name !== "string" ||
    typeof subtitle !== "string"
  ) {
    return jsonResponse({ error: "Ongeldige invoer" }, 400);
  }

  const cleanName = name.trim();
  const cleanSubtitle = subtitle.trim();

  // Controleer de maximale lengtes.
  if (
    !cleanName ||
    Array.from(cleanName).length > 20 ||
    Array.from(cleanSubtitle).length > 50
  ) {
    return jsonResponse({
      error: "Naam is verplicht (maximaal 20 tekens) en subtitel mag maximaal 50 tekens bevatten.",
    }, 400);
  }

  // Haal alle spelers op voordat we iets aanmaken.
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id");

  if (playersError) throw playersError;

  if (!players?.length) {
    return jsonResponse({ error: "Geen spelers gevonden" }, 500);
  }

  // Maak de nieuwe Affaire aan.
  const { data: affaire, error: affaireError } = await supabase
    .from("affaires")
    .insert({
      name: cleanName,
      subtitle: cleanSubtitle,
    })
    .select("id")
    .single();

  if (affaireError) throw affaireError;

  // Koppel de nieuwe Affaire aan iedere speler.
  const links = players.map((player) => ({
    player_id: player.id,
    affaire_id: affaire.id,
  }));

  const { error: linkError } = await supabase
    .from("player_affaires")
    .insert(links);

  // Ruim de Affaire op als het koppelen mislukt.
  if (linkError) {
    const { error: rollbackError } = await supabase
      .from("affaires")
      .delete()
      .eq("id", affaire.id);

    if (rollbackError) {
      console.error("Rollback mislukt:", rollbackError);
    }

    throw linkError;
  }

  return jsonResponse({
    success: true,
    affaireId: affaire.id,
  });
}


case "add_player_affaire": {
  const { affaireId } = params;

  if (typeof affaireId !== "string") {
    return jsonResponse({ error: "Ongeldige Affaire" }, 400);
  }

  // Controleer of de Affaire bestaat en toegankelijk is.
  if (!(await canAccessAffaire(affaireId))) {
    return jsonResponse({ error: "Geen toegang tot Affaire" }, 403);
  }

  // Registreer alleen de persoonlijke koppeling.
  const { error } = await supabase
    .from("player_affaires")
    .upsert(
      { player_id: playerId, affaire_id: affaireId },
      { onConflict: "player_id,affaire_id", ignoreDuplicates: true }
    );

  if (error) throw error;

  return jsonResponse({ success: true });
}
      case "remove_player_affaire": {
        const { affaireId } = params;

        if (typeof affaireId !== "string") {
          return jsonResponse({ error: "Ongeldige Affaire" }, 400);
        }

        const { error } = await supabase
          .from("player_affaires")
          .delete()
          .eq("player_id", playerId)
          .eq("affaire_id", affaireId);

        if (error) throw error;
        return jsonResponse({ success: true });
      }


      case "get_affaire_posts": {
        const { affaireId } = params;

        if (
          typeof affaireId !== "string" ||
          !(await canAccessAffaire(affaireId))
        ) {
          return jsonResponse({ error: "Geen toegang tot Affaire" }, 403);
        }

        const { data, error } = await supabase
          .from("affaire_posts")
          .select(`
            id,
            affaire_id,
            player_id,
            content,
            created_at,
            updated_at,
            players!affaire_posts_player_id_fkey (name)
          `)
          .eq("affaire_id", affaireId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return jsonResponse(data);
      }

      case "add_affaire_post": {
        const { affaireId, content } = params;

        if (
          typeof affaireId !== "string" ||
          typeof content !== "string" ||
          !content.trim() ||
          content.length > 10000 ||
          !(await canAccessAffaire(affaireId))
        ) {
          return jsonResponse({ error: "Ongeldige bijdrage of geen toegang" }, 403);
        }

        const { data, error } = await supabase
          .from("affaire_posts")
          .insert({
            affaire_id: affaireId,
            player_id: playerId,
            content: content.trim(),
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse(data);
      }

      default:
        return jsonResponse({ error: "Onbekende actie" }, 400);
    }
  } catch (error) {
    console.error("Player API error:", error);
    return jsonResponse(
      { error: "Er is een serverfout opgetreden" },
      500,
    );
  }
});
