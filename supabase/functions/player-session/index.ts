
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Methode niet toegestaan" }, 405);
  }

  try {
    const { sessionToken } = await req.json();

    if (
      typeof sessionToken !== "string" ||
      sessionToken.length < 20 ||
      sessionToken.length > 2048
    ) {
      return jsonResponse({ error: "Ongeldige sessie" }, 401);
    }

    const signingSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const signedSession = await verifySignedSessionToken(
      sessionToken,
      signingSecret,
    );

    if (signedSession) {
      return jsonResponse({
        valid: true,
        player: {
          id: signedSession.playerId,
          character_id: signedSession.characterId,
        },
        expiresAt: signedSession.expiresAt,
      }, 200);
    }

    // Tijdelijke compatibiliteit met bestaande sessies van vóór de wijziging.
    if (!/^[0-9a-f]{64}$/i.test(sessionToken)) {
      return jsonResponse({ error: "Sessie verlopen of ongeldig" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      signingSecret,
    );

    const sessionHash = await sha256(sessionToken);

    const { data: session, error } = await supabase
      .from("player_sessions")
      .select(`
        id,
        player_id,
        expires_at,
        revoked_at,
        players (
          id,
          character_id
        )
      `)
      .eq("token_hash", sessionHash)
      .maybeSingle();

    if (error) throw error;

    if (
      !session ||
      session.revoked_at !== null ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      return jsonResponse({ error: "Sessie verlopen of ongeldig" }, 401);
    }

    return jsonResponse({
      valid: true,
      player: {
        id: session.player_id,
        character_id: session.players?.[0]?.character_id ?? null,
      },
      expiresAt: session.expires_at,
    }, 200);

  } catch (error) {
    console.error("Player session error:", error);
    return jsonResponse(
      { error: "Er is een serverfout opgetreden" },
      500,
    );
  }
});
