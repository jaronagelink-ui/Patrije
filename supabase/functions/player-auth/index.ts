
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SESSION_DAYS = 7;

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}


async function generateSessionToken(
  playerId: string,
  characterId: string | null,
  expiresAt: string,
  secret: string,
): Promise<string> {
  const payload = JSON.stringify({
    playerId,
    characterId,
    exp: Math.floor(new Date(expiresAt).getTime() / 1000),
  });
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(payload));
  const signature = await signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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
    const body = await req.json();
    const { token, pin } = body;

    if (
      typeof token !== "string" ||
      typeof pin !== "string" ||
      token.length < 20 ||
      token.length > 512 ||
      pin.length < 1 ||
      pin.length > 32
    ) {
      return jsonResponse({ error: "Ongeldige inloggegevens" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Controleer de persoonlijke toegangstoken.
    const tokenHash = await sha256(token);

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, character_id, access_code_hash")
      .eq("access_token_hash", tokenHash)
      .maybeSingle();

    if (playerError) throw playerError;

    if (!player || !player.access_code_hash) {
      return jsonResponse({ error: "Ongeldige inloggegevens" }, 401);
    }

    // Registreer de inlogpoging en controleer de limiet.
    const { data: allowed, error: attemptError } = await supabase
      .rpc("consume_player_login_attempt", {
        p_token_hash: tokenHash,
      });

    if (attemptError) throw attemptError;

    if (allowed !== true) {
      return jsonResponse(
        {
          error: "Te veel inlogpogingen. Probeer het over 15 minuten opnieuw.",
        },
        429,
      );
    }

    // Controleer de pincode.
    const pinHash = await sha256(pin);

    if (pinHash !== player.access_code_hash) {
      return jsonResponse({ error: "Ongeldige inloggegevens" }, 401);
    }

    // Succesvolle login: reset de pogingteller.
    const { error: resetError } = await supabase
      .from("player_login_attempts")
      .delete()
      .eq("token_hash", tokenHash);

    if (resetError) throw resetError;

    // Maak een ondertekende spelerssessie die zonder databasecontrole
    // bij iedere API-aanroep kan worden geverifieerd.
    const expiresAt = new Date(
      Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const signingSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!signingSecret) throw new Error("Sessiesleutel ontbreekt");

    const sessionToken = await generateSessionToken(
      player.id,
      player.character_id ?? null,
      expiresAt,
      signingSecret,
    );

    return jsonResponse({
      sessionToken,
      expiresAt,
      player: {
        id: player.id,
        character_id: player.character_id,
      },
    }, 200);

  } catch (error) {
    console.error("Player authentication error:", error);

    return jsonResponse(
      { error: "Er is een serverfout opgetreden" },
      500,
    );
  }
});
