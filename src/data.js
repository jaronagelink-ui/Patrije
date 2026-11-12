
import { supabase } from './supabaseClient'

// Bewaar opgehaalde entiteitsteksten tijdens de actieve browsersessie.
const entityTextCache = new Map()
const affairePostsCache = new Map()
const CONTENT_CACHE_TTL = 5 * 60 * 1000

export function clearContentCache() {
  entityTextCache.clear()
  affairePostsCache.clear()
}


export async function getPlayerEntities(sessionToken) {
  return callPlayerApi(sessionToken, 'get_entities')
}

export async function getPlayerCharacter(sessionToken) {
  return callPlayerApi(sessionToken, 'get_character')
}

export async function getEntityText(sessionToken, entityId) {
  const cacheKey = `${sessionToken}:${entityId}`
  const cached = entityTextCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL) {
    return cached.promise
  }

  const promise = callPlayerApi(sessionToken, 'get_entity_text', {
    entityId,
  })

  entityTextCache.set(cacheKey, {
    timestamp: Date.now(),
    promise,
  })

  try {
    return await promise
  } catch (error) {
    entityTextCache.delete(cacheKey)
    throw error
  }
}


async function callPlayerApi(sessionToken, action, params = {}) {
  const { data, error } = await supabase.functions.invoke(
    'player-api',
    {
      body: {
        sessionToken,
        action,
        ...params,
      },
    }
  )

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function getPlayerCuriosa(sessionToken) {
  return callPlayerApi(sessionToken, 'get_curiosa')
}

export async function addPlayerCuriosa(sessionToken, entityId) {
  return callPlayerApi(sessionToken, 'add_curiosa', { entityId })
}

export async function removePlayerCuriosa(sessionToken, entityId) {
  return callPlayerApi(sessionToken, 'remove_curiosa', { entityId })
}

export async function markEntityViewed(sessionToken, entityId) {
  return callPlayerApi(sessionToken, 'mark_entity_viewed', {
    entityId,
  })
}

export async function markAffaireViewed(sessionToken, affaireId) {
  return callPlayerApi(sessionToken, 'mark_affaire_viewed', {
    affaireId,
  })
}
export async function getPlayerAffaires(sessionToken) {
  return callPlayerApi(sessionToken, 'get_player_affaires')
}

export async function createPlayerAffaire(sessionToken, name, subtitle) {
  return callPlayerApi(sessionToken, 'create_player_affaire', {
    name,
    subtitle,
  })
}




export async function getAffairePosts(sessionToken, affaireId) {
  const cacheKey = `${sessionToken}:${affaireId}`
  const cached = affairePostsCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL) {
    return cached.promise
  }

  const promise = callPlayerApi(sessionToken, 'get_affaire_posts', {
    affaireId,
  })

  affairePostsCache.set(cacheKey, {
    timestamp: Date.now(),
    promise,
  })

  try {
    return await promise
  } catch (error) {
    affairePostsCache.delete(cacheKey)
    throw error
  }
}


export async function addAffairePost(sessionToken, affaireId, content) {
  const result = await callPlayerApi(sessionToken, 'add_affaire_post', {
    affaireId,
    content,
  })

  affairePostsCache.delete(`${sessionToken}:${affaireId}`)
  return result
}


export async function authenticatePlayer(token, pin) {
  const { data, error } = await supabase.functions.invoke(
    'player-auth',
    {
      body: { token, pin },
    }
  )

  if (error) throw error

  return data
}


// ADMIN


export async function getAdminEntities(sessionToken) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_entities',
      sessionToken,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}




export async function getChronicles(sessionToken) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_chronicles',
      sessionToken,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}



export async function getAdminPlayers(sessionToken) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_players',
      sessionToken,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}



export async function getAdminEntityDetails(sessionToken, entityId) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_entity_details',
      sessionToken,
      entityId,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}



export async function getAdminProperties(sessionToken, entityId) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_properties',
      sessionToken,
      entityId,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}




export async function getAdminRelations(sessionToken, entityId) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_relations',
      sessionToken,
      entityId,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}



export async function getAdminPlayerAccess(sessionToken, entityId) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_player_access',
      sessionToken,
      entityId,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}



export async function getAdminTextBlockAccess(sessionToken, entityId) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_text_block_access',
      sessionToken,
      entityId,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}


export async function saveEntityTextAccess(
  sessionToken,
  rule
) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'save_entity_text_access',
      sessionToken,
      entityId: rule.entity_id,
      entityTextId: rule.entity_text_id,
      playerId: rule.player_id,
      available: rule.available === true,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}


export async function deleteEntityImage(sessionToken, imageUrl) {
  if (!imageUrl) return

  let pathname
  try {
    pathname = new URL(imageUrl).pathname
  } catch {
    throw new Error('De afbeeldings-URL is ongeldig; het bestand is niet verwijderd.')
  }

  const marker = '/Images/'
  const markerIndex = pathname.indexOf(marker)
  if (markerIndex === -1) {
    throw new Error('De afbeelding staat niet in de verwachte Images-bucket; het bestand is niet verwijderd.')
  }

  const imagePath = decodeURIComponent(
    pathname.slice(markerIndex + marker.length)
  )

  if (!imagePath) return

  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'delete_entity_image',
      sessionToken,
      imagePath,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}


export async function saveEntity(sessionToken, entity) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'save_entity',
      sessionToken,
      entity,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function saveEntityText(sessionToken, block) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'save_entity_text',
      sessionToken,
      block,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}


export async function deleteEntityText(sessionToken, id) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'delete_entity_text',
      sessionToken,
      id,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function saveEntityProperty(sessionToken, property) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'save_entity_property',
      sessionToken,
      property,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function deleteEntityProperty(sessionToken, id) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'delete_entity_property',
      sessionToken,
      id,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}


export async function saveEntityRelation(sessionToken, relation) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'save_entity_relation',
      sessionToken,
      relation,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function deleteEntityRelation(sessionToken, id) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'delete_entity_relation',
      sessionToken,
      id,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function setPlayerEntityAccess(sessionToken, playerId, entityId, available) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'set_player_entity_access',
      sessionToken,
      playerId,
      entityId,
      available,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function getAdminAffaires(sessionToken) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_admin_affaires',
      sessionToken,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}

export async function getAdminAffaireAccess(sessionToken, affaireId) {
  const { data, error } = await supabase.functions.invoke(
    'admin-api',
    {
      body: {
        action: 'get_affaire_access',
        sessionToken,
        affaireId,
      },
    }
  )

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data || []
}

export async function setPlayerAffaireAccess(
  sessionToken,
  playerId,
  affaireId,
  available
) {
  const { data, error } = await supabase.functions.invoke(
    'admin-api',
    {
      body: {
        action: 'set_affaire_access',
        sessionToken,
        playerId,
        affaireId,
        available,
      },
    }
  )

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}


export async function createAdminPlayer(sessionToken, name, characterId = null) {
  const { data, error } = await supabase.functions.invoke(
    'admin-api',
    {
      body: {
        action: 'create_player',
        sessionToken,
        name,
        characterId,
      },
    }
  )

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}

export async function saveAdminPlayerCharacters(sessionToken, assignments) {
  const { data, error } = await supabase.functions.invoke(
    'admin-api',
    {
      body: {
        action: 'save_player_characters',
        sessionToken,
        assignments,
      },
    }
  )

  if (error) {
    console.error('Fout bij opslaan spelers:', error)

    try {
      const details = await error.context.json()
      console.error('Details van de server:', details)
      throw new Error(details.error || error.message)
    } catch (detailError) {
      if (detailError.message !== error.message) {
        throw detailError
      }
      throw error
    }
  }

  if (data?.error) throw new Error(data.error)

  return data
}

export async function saveAdminPlayerPin(sessionToken, playerId, pin) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'set_player_pin',
      sessionToken,
      playerId,
      pin,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}


export async function resetAdminPlayerAccess(sessionToken, playerId) {
  const { data, error } = await supabase.functions.invoke(
    'admin-api',
    {
      body: {
        action: 'reset_player_access',
        sessionToken,
        playerId,
      },
    }
  )

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data
}



export async function uploadEntityImage(sessionToken, entityId, file) {
  if (!sessionToken) {
    throw new Error('Geen geldige beheerderssessie gevonden')
  }

  // Vraag via de beveiligde admin-api een tijdelijke uploadtoestemming aan
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'create_entity_image_upload',
      sessionToken,
      entityId,
      contentType: file.type,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  if (!data?.path || !data?.token) {
    throw new Error('Geen geldige uploadtoestemming ontvangen')
  }

  // Upload met de tijdelijke toestemming
  const { error: uploadError } = await supabase.storage
    .from('Images')
    .uploadToSignedUrl(data.path, data.token, file, {
      cacheControl: '3600',
      contentType: file.type,
    })

  if (uploadError) throw uploadError

  // Maak de publieke URL
  const { data: publicData } = supabase.storage
    .from('Images')
    .getPublicUrl(data.path)

  if (!publicData?.publicUrl) {
    throw new Error('Kon de publieke afbeeldings-URL niet maken.')
  }

  return publicData.publicUrl
}


export async function getOrCreatePlayerAccessToken(sessionToken, playerId) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: {
      action: 'get_or_create_player_access_token',
      sessionToken,
      playerId,
    },
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)

  return data.token
}