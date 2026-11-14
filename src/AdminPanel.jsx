import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  deleteEntityText,
  getAdminEntities,
  getAdminEntityDetails,
  getAdminPlayers,
  getAdminPlayerAccess,
  getAdminRelations,
  getAdminProperties,
  saveEntity,
  saveEntityText,
  saveEntityProperty,
  saveEntityRelation,
  setPlayerEntityAccess,
  deleteEntityProperty,
  deleteEntityRelation,
  getOrCreatePlayerAccessToken,
  createAdminPlayer,
  saveAdminPlayerCharacters,
  resetAdminPlayerAccess,
  saveAdminPlayerPin,
    uploadEntityImage,
  deleteEntityImage,
  getAdminTextBlockAccess,
  saveEntityTextAccess,
  getAdminAffaires,
getAdminAffaireAccess,
setPlayerAffaireAccess,
} from './data'

const TEXT_BLOCK_ORDER = [
  'body',
  'general',
  'additional_2',
  'bullet_list',
  'additional_3',
  'genealogy_list',
  'institute_members',
]

function sortTextBlocks(blocks) {
  return [...blocks].sort((a, b) => {
    const aIndex = TEXT_BLOCK_ORDER.indexOf(a.block_type)
    const bIndex = TEXT_BLOCK_ORDER.indexOf(b.block_type)
    return (aIndex < 0 ? TEXT_BLOCK_ORDER.length : aIndex) -
      (bIndex < 0 ? TEXT_BLOCK_ORDER.length : bIndex)
  })
}

const ENTITY_TYPES = [
  ['persoon', 'Persoon'],
  ['concept', 'Concept'],
  ['godheid', 'Godheid'],
  ['gebeurtenis', 'Gebeurtenis'],
  ['plek', 'Plek'],
  ['familie', 'Familie'],
  ['stam', 'Stam'],
  ['soort', 'Soort'],
  ['organisatie', 'Organisatie'],
  ['factie', 'Factie'],
  ['instituut', 'Instituut'],
  ['plateau', 'Plateau'],
  ['plaats', 'Plaats'],
  ['hoofdstad', 'Hoofdstad'],
  ['vrijstad', 'Vrijstad'],
  ['stad', 'Stad'],
  ['kroniek', 'Kroniek'],
  ['karakter', 'karakter'],
]

function emptyEntity() {
  return {
    id: null,
    name: '',
    type: 'persoon',
    subtitle: '',
    image_url: '',
    sort_order: null,
    visible_to_all: true,
  }
}

function AdminPanel({ onExit, adminSessionToken }) {
    const [section, setSection] = useState('entities')
  const [entities, setEntities] = useState([])
  const [players, setPlayers] = useState([])
  const [playerCharacterDrafts, setPlayerCharacterDrafts] = useState({})
const [newPlayers, setNewPlayers] = useState([])
const [newPlayerName, setNewPlayerName] = useState('')
const [newPlayerCharacterId, setNewPlayerCharacterId] = useState('')
const [showNewPlayerForm, setShowNewPlayerForm] = useState(false)
const [playersSaving, setPlayersSaving] = useState(false)
  const [affaires, setAffaires] = useState([])
const [selectedAffaireId, setSelectedAffaireId] = useState(null)
const [affaireAccess, setAffaireAccess] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [entity, setEntity] = useState(emptyEntity())
  const [textBlocks, setTextBlocks] = useState([])
  const [properties, setProperties] = useState([])
  const [relations, setRelations] = useState([])
  const [access, setAccess] = useState([])
  const [textBlockAccess, setTextBlockAccess] = useState([])
  const [deletedTextIds, setDeletedTextIds] = useState([])
  const [deletedPropertyIds, setDeletedPropertyIds] = useState([])
  const [deletedRelationIds, setDeletedRelationIds] = useState([])
  const [originalImageUrl, setOriginalImageUrl] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [quickText, setQuickText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [qrPlayer, setQrPlayer] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [qrGenerating, setQrGenerating] = useState(false)
  const [pinPlayer, setPinPlayer] = useState(null)
  const [pinValue, setPinValue] = useState('')
  const [pinSaving, setPinSaving] = useState(false)


  
  const handleGeneratePlayerQr = async (player) => {
    setQrGenerating(true)
    setError('')

    try {
      const token = await getOrCreatePlayerAccessToken(adminSessionToken, player.id)
const url = `${window.location.origin}${import.meta.env.BASE_URL}p/${token}`
      const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 })

      const updatedPlayer = { ...player, access_token: token }
      setPlayers(current => current.map(item => item.id === player.id ? updatedPlayer : item))
      setQrPlayer(updatedPlayer)
      setQrUrl(url)
      setQrDataUrl(dataUrl)
      setMessage(`Vaste toegang voor ${player.name || 'de speler'} is gereed.`)
    } catch (err) {
      console.error(err)
      setError(err.message || 'QR-code maken mislukt.')
    } finally {
      setQrGenerating(false)
    }
  }


const handleSavePlayerPin = async () => {
  if (!pinPlayer || !/^\d{4}$/.test(pinValue)) {
    setError('Vul een PIN-code van precies vier cijfers in.')
    return
  }

  setPinSaving(true)
  setError('')
  setMessage('')

  try {
    await saveAdminPlayerPin(adminSessionToken, pinPlayer.id, pinValue)
    setMessage(`De PIN-code voor ${pinPlayer.name || 'de speler'} is opgeslagen.`)
    setPinPlayer(null)
    setPinValue('')
  } catch (err) {
    console.error(err)
    setError(err.message || 'PIN-code opslaan is mislukt.')
  } finally {
    setPinSaving(false)
  }
}


const handleResetPlayerAccess = async (player) => {
  const confirmed = window.confirm(
    `Weet je zeker dat je de toegang van ${player.name || 'deze speler'} wilt resetten? De huidige QR-code en link werken daarna niet meer.`
  )

  if (!confirmed) return

  setError('')
  setMessage('')

  try {
    await resetAdminPlayerAccess(adminSessionToken, player.id)

    setPlayers(current =>
      current.map(item =>
        item.id === player.id
          ? { ...item, access_token: null }
          : item
      )
    )

    if (qrPlayer?.id === player.id) {
      setQrPlayer(null)
      setQrDataUrl('')
      setQrUrl('')
    }

    setMessage(`De toegang van ${player.name || 'de speler'} is gereset.`)
  } catch (err) {
    console.error(err)
    setError(err.message || 'Toegang resetten mislukt.')
  }
}

  const loadBase = async () => {
    setLoading(true)
    setError('')
    try {
const [entityData, playerData, affaireData] = await Promise.all([
  getAdminEntities(adminSessionToken),
  getAdminPlayers(adminSessionToken),
  getAdminAffaires(adminSessionToken),
])
      setEntities(entityData)
      setPlayers(playerData)
      setAffaires(affaireData)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Kon beheerdata niet laden.')
    } finally {
      setLoading(false)
    }
  }


  const handleAddNewPlayer = () => {
    const name = newPlayerName.trim()

    if (!name) {
      setError('Vul eerst een spelersnaam in.')
      return
    }

    if (
      players.some(player => player.name.toLowerCase() === name.toLowerCase()) ||
      newPlayers.some(player => player.name.toLowerCase() === name.toLowerCase())
    ) {
      setError('Deze spelersnaam bestaat al.')
      return
    }

    setNewPlayers(current => [
      ...current,
      {
        tempId: crypto.randomUUID(),
        name,
        character_id: newPlayerCharacterId || null,
      },
    ])

    setNewPlayerName('')
    setNewPlayerCharacterId('')
    setShowNewPlayerForm(false)
    setError('')
  }

  const handleSavePlayers = async () => {
    setPlayersSaving(true)
    setError('')
    setMessage('')

    try {
      // Eerst de bestaande karakterkoppelingen opslaan.
      const assignments = players.map(player => ({
        playerId: player.id,
        characterId: Object.prototype.hasOwnProperty.call(
          playerCharacterDrafts,
          player.id
        )
          ? playerCharacterDrafts[player.id] || null
          : player.character_id || null,
      }))

      if (assignments.length > 0) {
        await saveAdminPlayerCharacters(adminSessionToken, assignments)
      }

      // Daarna de nieuwe spelers aanmaken.
      const pendingPlayers = [...newPlayers]

      while (pendingPlayers.length > 0) {
        const player = pendingPlayers[0]

        await createAdminPlayer(
          adminSessionToken,
          player.name,
          player.character_id
        )

        pendingPlayers.shift()
        setNewPlayers([...pendingPlayers])
      }

      await loadBase()

      setPlayerCharacterDrafts({})
      setNewPlayers([])
      setMessage('Alle spelersgegevens zijn opgeslagen.')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Spelers opslaan is mislukt.')
    } finally {
      setPlayersSaving(false)
    }
  }


  const loadAffaireAccess = async (affaireId) => {
  if (!affaireId) {
    setAffaireAccess([])
    return
  }

  try {
const data = await getAdminAffaireAccess(
  adminSessionToken,
  affaireId
)
    setAffaireAccess(data)
    setError('')
  } catch (err) {
    console.error(err)
    setError(err.message || 'Toegangsregels konden niet worden geladen.')
  }
}

  useEffect(() => {
    loadBase()
  }, [])

  const loadEntity = async (id) => {
    if (!id) {
      setSelectedId(null)
      setEntity(emptyEntity())
      setTextBlocks([])
      setProperties([])
      setRelations([])
      setAccess([])
      setTextBlockAccess([])
      setDeletedTextIds([])
      setDeletedPropertyIds([])
      setDeletedRelationIds([])
      setOriginalImageUrl('')
      return
    }

    setSelectedId(id)
    setError('')
    try {
      const details = await getAdminEntityDetails(adminSessionToken, id)
      const [textData, propertyData, relationData, accessData, blockAccessData] = await Promise.all([
        details.text,
        getAdminProperties(adminSessionToken, id),
        getAdminRelations(adminSessionToken, id),
        getAdminPlayerAccess(adminSessionToken, id),
        getAdminTextBlockAccess(adminSessionToken, id),
      ])

      setEntity(details.entity)
      setTextBlocks(sortTextBlocks(textData))
      setProperties(propertyData)
      setRelations(relationData)
      setAccess(accessData)
      setTextBlockAccess(blockAccessData)
      setDeletedTextIds([])
      setDeletedPropertyIds([])
      setDeletedRelationIds([])
      setOriginalImageUrl(details.entity.image_url || '')
      setMessage('')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Kon entity niet laden.')
    }
  }

  const filteredEntities = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return entities.filter(item => {
      const matchesSearch = !needle ||
        item.name.toLowerCase().includes(needle) ||
        (item.subtitle || '').toLowerCase().includes(needle)
      const matchesType = !typeFilter || item.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [entities, search, typeFilter])

  const newEntity = () => {
    setSection('entities')
    setSelectedId(null)
    setEntity(emptyEntity())
    setTextBlocks([])
    setProperties([])
    setRelations([])
    setAccess([])
    setTextBlockAccess([])
    setDeletedTextIds([])
    setDeletedPropertyIds([])
    setDeletedRelationIds([])
    setOriginalImageUrl('')
    setMessage('Nieuwe entity')
    setError('')
  }

  const handleImageUpload = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''

  if (!file || !entity.id) return

  if (!file.type.startsWith('image/')) {
    setError('Kies een afbeeldingsbestand.')
    return
  }

  if (file.size > 20 * 1024 * 1024) {
    setError('De afbeelding mag maximaal 20 MB zijn.')
    return
  }

  setImageUploading(true)
  setError('')
  setMessage('Afbeelding uploaden...')

  try {
    const imageUrl = await uploadEntityImage(
  adminSessionToken,
  entity.id,
  file
)

    setEntity(current => ({
      ...current,
      image_url: imageUrl,
    }))

    setMessage('Afbeelding geüpload. Sla de entity op om de wijziging te bewaren.')
  } catch (err) {
    console.error(err)
    setError(err.message || 'Afbeelding uploaden mislukt.')
    setMessage('')
  } finally {
    setImageUploading(false)
  }
}

  const handleSaveEntity = async () => {
    if (!entity.name.trim()) {
      setError('Een entity heeft minimaal een naam nodig.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('Alle wijzigingen opslaan...')
    try {
      const entityToSave = {
  ...entity,
  id: entity.id || selectedId,
}

const savedEntity = await saveEntity(adminSessionToken, entityToSave)

      const savedTexts = await Promise.all(
        textBlocks.map(block => saveEntityText(adminSessionToken, { ...block, entity_id: savedEntity.id }))
      )
      const savedProperties = await Promise.all(
        properties
          .filter(property => (property.property_type || '').trim() || (property.value || '').trim())
          .map(property => saveEntityProperty(adminSessionToken, { ...property, entity_id: savedEntity.id }))
      )
      const savedRelations = await Promise.all(
        relations
          .filter(relation => relation.target_entity_id && (relation.relation_type || '').trim())
          .map(relation => saveEntityRelation(adminSessionToken, { ...relation, source_entity_id: savedEntity.id }))
      )

      await Promise.all([
        ...deletedTextIds.map(id => deleteEntityText(adminSessionToken, id)),
        ...deletedPropertyIds.map(id => deleteEntityProperty(adminSessionToken, id)),
        ...deletedRelationIds.map(id => deleteEntityRelation(adminSessionToken, id)),
      ])

      const accessWrites = []
      for (let index = 0; index < textBlocks.length; index += 1) {
        const oldBlock = textBlocks[index]
        const savedBlock = savedTexts[index]
        if (!savedBlock) continue
        // Als er voor dit blok geen expliciete toegangsinstellingen zijn,
        // laat het blok de zichtbaarheid van de entiteit erven.
        const hasBlockRules = textBlockAccess.some(row => row.entity_text_id === oldBlock.id)
        if (!hasBlockRules) continue
        for (const player of players) {
          const explicitRule = textBlockAccess.find(
            row => row.entity_text_id === oldBlock.id && row.player_id === player.id
          )
          const entityRule = access.find(row => row.player_id === player.id)
          const defaultAvailable = entityRule
            ? entityRule.available === true
            : savedEntity.visible_to_all !== false
          accessWrites.push(saveEntityTextAccess(adminSessionToken, {
            entity_id: savedEntity.id,
            entity_text_id: savedBlock.id,
            player_id: player.id,
            available: explicitRule ? explicitRule.available === true : defaultAvailable,
          }))
        }
      }
      await Promise.all(accessWrites)

      if (originalImageUrl && originalImageUrl !== (savedEntity.image_url || '')) {
        await deleteEntityImage(adminSessionToken, originalImageUrl)
      }

      setEntity(savedEntity)
      setSelectedId(savedEntity.id)
      setTextBlocks(sortTextBlocks(savedTexts))
      setProperties(savedProperties)
      setRelations(savedRelations)
      setDeletedTextIds([])
      setDeletedPropertyIds([])
      setDeletedRelationIds([])
      setOriginalImageUrl(savedEntity.image_url || '')
      setTextBlockAccess(await getAdminTextBlockAccess(adminSessionToken, savedEntity.id))
      await loadBase()


      // Andere tabbladen op dezelfde site kunnen hiermee de opgeslagen entity opnieuw ophalen.
      try {
        localStorage.setItem('res-politica-entity-updated', JSON.stringify({ entityId: savedEntity.id, timestamp: Date.now() }))
      } catch (storageError) {
        console.warn('Preview-tabbladen konden niet automatisch worden geïnformeerd:', storageError)
      }
      setMessage('Entity en alle onderliggende onderdelen opgeslagen.')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Opslaan mislukt. Controleer de wijzigingen en probeer opnieuw.')
      setMessage('')
    } finally {
      setSaving(false)
    }
  }

  const applyQuickText = () => {
    const lines = quickText.split(/\r?\n/)
    const nonEmpty = lines.map(line => line.trim()).filter(Boolean)
    if (!nonEmpty.length) return

    const next = { ...entity, name: nonEmpty[0] }
    if (nonEmpty.length > 1) next.subtitle = nonEmpty[1]
    setEntity(next)

    if (nonEmpty.length > 2) {
      setTextBlocks([{ id: null, entity_id: entity.id, block_type: 'body', content: nonEmpty.slice(2).join('\n\n'), published: true }])
    }

    setMessage('Tekst verwerkt. Controleer de velden en sla daarna op.')
  }

  const saveTextBlock = async (block) => {
    if (!entity.id || !block.content.trim()) return
    const saved = await saveEntityText(adminSessionToken, { ...block, entity_id: entity.id })
    setTextBlocks(current => current.map(item => item.id === block.id ? saved : item))
  }

  const addTextBlock = () => {
    const nextType = TEXT_BLOCK_ORDER.find(type =>
      !textBlocks.some(block => block.block_type === type)
    )

    if (!nextType) {
      setError('Alle vaste tekstvelden bestaan al. Je kunt een bestaand veld bewerken.')
      return
    }

    setTextBlocks(current => sortTextBlocks([
      ...current,
      {
        id: `new-${Date.now()}`,
        entity_id: entity.id,
        block_type: nextType,
        content: '',
        published: true,
        unsaved: true,
      },
    ]))
    setError('')
  }

  const saveProperty = async (property) => {
    if (!entity.id || !property.value.trim()) return
    const saved = await saveEntityProperty(adminSessionToken, { ...property, entity_id: entity.id })
    setProperties(current => current.map(item => item.id === property.id ? saved : item))
  }

  const addProperty = () => {
    setProperties(current => [
      ...current,
      { id: `new-${Date.now()}`, entity_id: entity.id, property_type: '', value: '', visible: true, unsaved: true },
    ])
  }

  const saveRelation = async (relation) => {
    if (!entity.id || !relation.target_entity_id || !relation.relation_type.trim()) return
    const saved = await saveEntityRelation(adminSessionToken, { ...relation, source_entity_id: entity.id })
    setRelations(current => current.map(item => item.id === relation.id ? saved : item))
  }

  const addRelation = () => {
    setRelations(current => [
      ...current,
      { id: `new-${Date.now()}`, source_entity_id: entity.id, relation_type: '', target_entity_id: '', position: 0, visible: true, unsaved: true },
    ])
  }


  const togglePlayerAccess = async (playerId, available) => {
    if (!entity.id) return

    try {
      await setPlayerEntityAccess(adminSessionToken, playerId, entity.id, available)

      setAccess(current => {
        const existing = current.find(row => row.player_id === playerId)

        if (existing) {
          return current.map(row =>
            row.player_id === playerId
              ? { ...row, available }
              : row
          )
        }

        return [
          ...current,
          {
            player_id: playerId,
            entity_id: entity.id,
            available,
            block_type: null,
            property_type: null,
            relation_id: null,
          },
        ]
      })

      setMessage('Zichtbaarheid bijgewerkt.')
      setError('')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Toegang wijzigen mislukt.')
    }
  }


  const toggleAllPlayerAccess = async (visible) => {
    if (!entity.id) return

    setError('')
    setMessage('Zichtbaarheid bijwerken...')

    try {
      const savedEntity = await saveEntity(adminSessionToken, {
  ...entity,
  visible_to_all: visible,
})

      await Promise.all(
        players.map(player =>
          setPlayerEntityAccess(adminSessionToken, player.id, entity.id, visible)
        )
      )

      setEntity(savedEntity)

      setAccess(current => {
        const next = [...current]

        for (const player of players) {
          const index = next.findIndex(
            row => row.player_id === player.id
          )

          const updatedRow = {
            ...(index >= 0 ? next[index] : {}),
            player_id: player.id,
            entity_id: entity.id,
            available: visible,
            block_type: null,
            property_type: null,
            relation_id: null,
          }

          if (index >= 0) {
            next[index] = updatedRow
          } else {
            next.push(updatedRow)
          }
        }

        return next
      })

      setEntities(current =>
        current.map(item =>
          item.id === entity.id
            ? { ...item, visible_to_all: visible }
            : item
        )
      )

      setMessage(
        visible
          ? 'De entity is zichtbaar voor alle spelers.'
          : 'De entity is verborgen voor alle spelers.'
      )
    } catch (err) {
      console.error(err)
      setError(err.message || 'Zichtbaarheid wijzigen mislukt.')
      await loadEntity(entity.id)
    }
  }


  const deleteText = (block) => {
    if (block.id && !String(block.id).startsWith('new-')) setDeletedTextIds(current => [...current, block.id])
    setTextBlocks(current => current.filter(item => item.id !== block.id))
    setTextBlockAccess(current => current.filter(row => row.entity_text_id !== block.id))
  }

  const deleteProperty = (property) => {
    if (property.id && !String(property.id).startsWith('new-')) setDeletedPropertyIds(current => [...current, property.id])
    setProperties(current => current.filter(item => item.id !== property.id))
  }

  const deleteRelation = (relation) => {
    if (relation.id && !String(relation.id).startsWith('new-')) setDeletedRelationIds(current => [...current, relation.id])
    setRelations(current => current.filter(item => item.id !== relation.id))
  }

    const getAvailableCharacters = (playerId, currentCharacterId) => {
    const assignedByOthers = new Set([
      ...players
        .filter(player => player.id !== playerId)
        .map(player =>
          Object.prototype.hasOwnProperty.call(playerCharacterDrafts, player.id)
            ? playerCharacterDrafts[player.id]
            : player.character_id
        ),
      ...newPlayers
        .filter(player => player.tempId !== playerId)
        .map(player => player.character_id),
    ].filter(Boolean))

    return entities.filter(entity =>
      entity.type === 'karakter' &&
      (!assignedByOthers.has(entity.id) || entity.id === currentCharacterId)
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">RES POLITICA</div>
        <div className="admin-label">BEHEER</div>
        <nav className="admin-nav">
          <button className={section === 'dashboard' ? 'active' : ''} onClick={() => setSection('dashboard')}>Overzicht</button>
          <button className={section === 'entities' ? 'active' : ''} onClick={() => setSection('entities')}>Entiteiten</button>
          <button className={section === 'affaires' ? 'active' : ''} onClick={() => setSection('affaires')}>Affaires</button>
          <button className={section === 'players' ? 'active' : ''} onClick={() => setSection('players')}>Spelers</button>
        </nav>
        <div className="admin-sidebar-bottom">
          <button onClick={onExit}>← Naar website</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <div className="admin-kicker">BEHEER</div>
            <h1>{section === 'entities' ? 'Entiteiten' : section === 'affaires' ? 'Affaires' : section === 'players' ? 'Spelers' : 'Overzicht'}</h1>
          </div>
          {section === 'entities' && <button className="admin-primary" onClick={newEntity}>+ Nieuwe entiteit</button>}
        </header>

        {message && <div className="admin-message">{message}</div>}
        {error && <div className="admin-error">{error}</div>}

        {section === 'dashboard' && (
          <section className="admin-dashboard">
            <div className="admin-stat"><span>Entiteiten</span><strong>{entities.length}</strong></div>
            <div className="admin-stat"><span>Spelers</span><strong>{players.length}</strong></div>
            <div className="admin-card">
              <h2>Snelle invoer</h2>
              <p>Plak tekst uit Word. De eerste regel wordt de naam, de tweede de ondertitel en de rest de eerste tekst.</p>
              <textarea value={quickText} onChange={e => setQuickText(e.target.value)} placeholder="Naam\nOndertitel\n\nTekst..." />
              <button className="admin-primary" onClick={() => { setSection('entities'); applyQuickText() }}>Naar entity-editor</button>
            </div>
          </section>
        )}

        {section === 'entities' && (
          <div className="admin-entities-layout">
            <section className="admin-list-panel">
              <div className="admin-list-tools">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken..." />
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="">Alle types</option>
                  {ENTITY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              {loading ? <p>Laden...</p> : filteredEntities.map(item => (
                <button key={item.id} className={`admin-entity-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => loadEntity(item.id)}>
                  <span><strong>{item.name}</strong><small>{item.subtitle || item.type}</small></span>
                  <span className={`admin-visibility-dot ${item.visible_to_all ? 'on' : ''}`} title={item.visible_to_all ? 'Zichtbaar voor alle spelers' : 'Verborgen voor alle spelers'} />
                </button>
              ))}
            </section>

            <section className="admin-editor">
              <div className="admin-editor-heading">
                <div><span className="admin-kicker">ENTITY</span><h2>{entity.id ? entity.name || 'Naamloos' : 'Nieuwe entiteit'}</h2></div>
              </div>

              <div className="admin-form-grid">
                <label>Naam<input value={entity.name} onChange={e => setEntity({ ...entity, name: e.target.value })} /></label>
                <label>Type<select value={entity.type} onChange={e => setEntity({ ...entity, type: e.target.value })}>{ENTITY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
 <label className="wide">Ondertitel<input value={entity.subtitle || ''} onChange={e => setEntity({ ...entity, subtitle: e.target.value })} /></label>
               {entity.type === 'kroniek' && (
  <label>
    Volgnummer
    <input
      type="number"
      min="1"
      step="1"
      value={entity.sort_order ?? ''}
      onChange={e =>
        setEntity({
          ...entity,
          sort_order: e.target.value === ''
            ? null
            : Number(e.target.value),
        })
      }
      placeholder="Bijv. 1"
    />
    <small>
      Bepaalt de volgorde in het kroniekenmenu.
    </small>
  </label>
)}
<div className="wide admin-image-field">
  <span className="admin-field-label">Afbeelding</span>

  {entity.image_url && (
    <>
      <div className="admin-image-preview">
        <img
          src={entity.image_url}
          alt={entity.name || 'Afbeelding'}
        />
      </div>
      <button
        type="button"
        onClick={() => setEntity(current => ({ ...current, image_url: '' }))}
        disabled={imageUploading || saving}
      >
        Afbeelding verwijderen
      </button>
    </>
  )}

  <label className="admin-upload-button">
    {imageUploading ? 'Afbeelding uploaden...' : 'Afbeelding kiezen'}

    <input
      type="file"
      accept="image/*"
      onChange={handleImageUpload}
      disabled={imageUploading || !entity.id}
    />
  </label>

  {!entity.id && (
    <small className="admin-help">
      Sla de entity eerst op voordat je een afbeelding uploadt.
    </small>
  )}

  {entity.image_url && (
    <small className="admin-help">
      De huidige afbeelding staat in Supabase Storage.
    </small>
  )}
</div>              </div>


              <div className="admin-section-card">
                <div className="admin-section-title"><h3>Tekst</h3><button onClick={addTextBlock}>+ Blok</button></div>
                {textBlocks.length === 0 && <p className="admin-muted">Nog geen tekstblokken.</p>}
                {textBlocks.map((block, index) => (
                  <div className="admin-block" key={block.id}>
<div className="admin-block-head">
  <select
    value={block.block_type || 'body'}
    onChange={e =>
      setTextBlocks(c => sortTextBlocks(
        c.map(x =>
          x.id === block.id
            ? { ...x, block_type: e.target.value }
            : x
        )
      ))
    }
  >
    <option value="body">Body — gewone tekst</option>
    <option value="general">Aanvullende tekst 1</option>
    <option value="additional_2">Aanvullende tekst 2</option>
    <option value="institute_members">Institute members</option>
    <option value="bullet_list">Bulletpoints — opsomming</option>
    <option value="additional_3">Aanvullende tekst 3</option>
    <option value="genealogy_list">Genealogische lijst</option>
  </select>

  <label>
    <input
      type="checkbox"
      checked={block.published !== false}
      onChange={e =>
        setTextBlocks(c =>
          c.map(x =>
            x.id === block.id
              ? { ...x, published: e.target.checked }
              : x
          )
        )
      }
    />
    gepubliceerd
  </label>
</div>                    <textarea value={block.content || ''} onChange={e => setTextBlocks(c => c.map(x => x.id === block.id ? { ...x, content: e.target.value } : x))} placeholder={`Tekstblok ${index + 1}`} />
                    {entity.id && (
                      <div className="admin-text-block-access">
                        <strong>Zichtbaar voor</strong>
                        <div className="admin-player-access-list">
                          {players.map(player => {
                            const rule = textBlockAccess.find(row => row.entity_text_id === block.id && row.player_id === player.id)
                            const entityRule = access.find(row => row.player_id === player.id)
                            const available = rule
                              ? rule.available === true
                              : entityRule
                                ? entityRule.available === true
                                : entity.visible_to_all !== false
                            return (
                              <label className="admin-player-access" key={player.id}>
                                <input
                                  type="checkbox"
                                  checked={available}
                                  onChange={event => setTextBlockAccess(current => {
                                    const existing = current.findIndex(row => row.entity_text_id === block.id && row.player_id === player.id)
                                    const updated = { entity_id: entity.id, entity_text_id: block.id, player_id: player.id, available: event.target.checked }
                                    if (existing >= 0) return current.map((row, i) => i === existing ? { ...row, ...updated } : row)
                                    return [...current, updated]
                                  })}
                                />
                                <span>{player.name || player.id}</span>
                              </label>
                            )
                          })}
                        </div>
                        {String(block.id).startsWith('new-') && (
                          <small className="admin-help">Sla de entity op om de toegang voor dit nieuwe blok vast te leggen.</small>
                        )}
                      </div>
                    )}
                    <div className="admin-inline-actions"><button onClick={() => deleteText(block)}>Verwijderen</button></div>
                  </div>
                ))}
              </div>

              <div className="admin-section-card">
                <div className="admin-section-title"><h3>Eigenschappen</h3><button onClick={addProperty}>+ Eigenschap</button></div>
                {properties.map(property => (
                  <div className="admin-property-row" key={property.id}>
                    <input placeholder="type" value={property.property_type || ''} onChange={e => setProperties(c => c.map(x => x.id === property.id ? { ...x, property_type: e.target.value } : x))} />
                    <input placeholder="waarde" value={property.value || ''} onChange={e => setProperties(c => c.map(x => x.id === property.id ? { ...x, value: e.target.value } : x))} />
                    <label title="Zichtbaar"><input type="checkbox" checked={property.visible !== false} onChange={e => setProperties(c => c.map(x => x.id === property.id ? { ...x, visible: e.target.checked } : x))} /></label>
                    <button onClick={() => deleteProperty(property)}>×</button>
                  </div>
                ))}
              </div>

              <div className="admin-section-card">
                <div className="admin-section-title"><h3>Relaties</h3><button onClick={addRelation}>+ Relatie</button></div>
                {relations.map(relation => (
                  <div className="admin-property-row" key={relation.id}>
                    <input placeholder="relatietype" value={relation.relation_type || ''} onChange={e => setRelations(c => c.map(x => x.id === relation.id ? { ...x, relation_type: e.target.value } : x))} />
                    <select value={relation.target_entity_id || ''} onChange={e => setRelations(c => c.map(x => x.id === relation.id ? { ...x, target_entity_id: e.target.value } : x))}>
                      <option value="">Kies doel...</option>
                      {entities.filter(x => x.id !== entity.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <button onClick={() => deleteRelation(relation)}>×</button>
                  </div>
                ))}
              </div>


  {entity.id && (
    <div className="admin-section-card">
      <div className="admin-section-title">
        <h3>Zichtbaarheid</h3>
      </div>

      <p className="admin-help">
        Vink aan welke spelers deze entity mogen zien.
        Als alle spelers toegang hebben, wordt de algemene
        zichtbaarheid automatisch ingeschakeld.
      </p>

      <label className="admin-global-visibility">
        <input
          type="checkbox"
          checked={players.length > 0 && players.every(player => {
            const row = access.find(item => item.player_id === player.id)
            return row ? row.available === true : entity.visible_to_all === true
          })}
          onChange={e => toggleAllPlayerAccess(e.target.checked)}
        />
        <span>
          <strong>Zichtbaar voor alle spelers</strong>
        </span>
      </label>

      <div className="admin-player-access-list">
        {players.map(player => {
          const row = access.find(item => item.player_id === player.id)
          const available = row
            ? row.available === true
            : entity.visible_to_all === true

          return (
            <label className="admin-player-access" key={player.id}>
              <input
                type="checkbox"
                checked={available}
                onChange={e =>
                  togglePlayerAccess(player.id, e.target.checked)
                }
              />
              <span>{player.name || player.id}</span>
            </label>
          )
        })}
      </div>
    </div>
  )}


              <div className="admin-save-bar">
                <button className="admin-primary" disabled={saving || imageUploading} onClick={handleSaveEntity}>{saving ? 'Opslaan...' : 'Entity opslaan'}</button>
              </div>
            </section>
          </div>
        )}

        {section === 'players' && (
          <section className="admin-card">
            <h2>Spelers</h2>
            <p>
              Iedere speler krijgt één vaste persoonlijke toegang.
              De QR-code en link veranderen daarna niet meer.
            </p>

            {players.map(player => {
              const characterId = Object.prototype.hasOwnProperty.call(
                playerCharacterDrafts,
                player.id
              )
                ? playerCharacterDrafts[player.id] || ''
                : player.character_id || ''

return (
  <div className="admin-player-list-row" key={player.id}>
<div className="admin-player-name">
  <strong>{player.name || 'Naamloos'}</strong>
</div>

    <select
      value={characterId}
      onChange={event =>
        setPlayerCharacterDrafts(current => ({
          ...current,
          [player.id]: event.target.value || null,
        }))
      }
    >
      <option value="">Geen karakter</option>
      {getAvailableCharacters(player.id, characterId).map(character => (
        <option key={character.id} value={character.id}>
          {character.name}
        </option>
      ))}
    </select>

<div className="admin-player-actions">
  <button
    className="admin-primary"
    onClick={() => handleGeneratePlayerQr(player)}
    disabled={qrGenerating}
  >
    📱 QR-code
  </button>

  <button
    className="admin-primary"
    onClick={() => {
      setPinPlayer(player)
      setPinValue('')
      setError('')
      setMessage('')
    }}
  >
    PIN
  </button>

  <button
    className="admin-primary"
    onClick={() => handleResetPlayerAccess(player)}
  >
    Reset
  </button>
</div>
  </div>
)            })}

            {newPlayers.map(player => (
<div className="admin-player-list-row" key={player.tempId}>
  <div className="admin-player-name">
    <strong>{player.name}</strong>
    <small>Nieuwe speler</small>
  </div>

  <select
    value={player.character_id || ''}
    onChange={event =>
      setNewPlayers(current =>
        current.map(item =>
          item.tempId === player.tempId
            ? { ...item, character_id: event.target.value || null }
            : item
        )
      )
    }
  >
    <option value="">Geen karakter</option>
    {getAvailableCharacters(player.tempId, player.character_id).map(character => (
      <option key={character.id} value={character.id}>
        {character.name}
      </option>
    ))}
  </select>

  <button
    className="admin-secondary"
    onClick={() =>
      setNewPlayers(current =>
        current.filter(item => item.tempId !== player.tempId)
      )
    }
  >
    Verwijderen
  </button>
</div>
            ))}

{showNewPlayerForm && (
  <div className="admin-player-form">
    <h3>Nieuwe speler</h3>

    <div className="admin-player-form-fields">
      <label>
        Naam speler
        <input
          value={newPlayerName}
          onChange={event => setNewPlayerName(event.target.value)}
          placeholder="Naam"
          maxLength={80}
        />
      </label>

      <label>
        Karakter (optioneel)
        <select
          value={newPlayerCharacterId}
          onChange={event => setNewPlayerCharacterId(event.target.value)}
        >
          <option value="">Geen karakter</option>
          {getAvailableCharacters(null, '').map(character => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </label>

      <div className="admin-player-form-actions">
<button className="admin-primary" onClick={handleAddNewPlayer}>
  Toevoegen
</button>

        <button
          className="admin-primary"
          onClick={() => {
            setShowNewPlayerForm(false)
            setNewPlayerName('')
            setNewPlayerCharacterId('')
          }}
        >
          Annuleren
        </button>
      </div>
    </div>
  </div>
)}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="admin-secondary"
                onClick={() => setShowNewPlayerForm(true)}
                disabled={showNewPlayerForm}
              >
                + Nieuwe speler
              </button>

              <button
                className="admin-primary"
                onClick={handleSavePlayers}
                disabled={playersSaving}
              >
                {playersSaving ? 'Opslaan...' : 'Spelers opslaan'}
              </button>
            </div>

            {pinPlayer && (
              <div
                onClick={() => {
                  if (!pinSaving) {
                    setPinPlayer(null)
                    setPinValue('')
                  }
                }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.65)',
                  zIndex: 1001,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                }}
              >
                <div
                  className="admin-section-card"
                  onClick={event => event.stopPropagation()}
                  style={{
                    background: 'white',
                    color: '#25231f',
                    padding: '2rem',
                    borderRadius: '8px',
                    width: '360px',
                    maxWidth: '100%',
                  }}
                >
                  <h3>PIN-code voor {pinPlayer.name || 'speler'}</h3>
                  <p className="admin-help">
                    Vul een code van vier cijfers in.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pinValue}
                    onChange={event =>
                      setPinValue(event.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="Bijv. 1234"
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: '0.5rem',
                      fontSize: '1.5rem',
                      letterSpacing: '0.2rem',
                      textAlign: 'center',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      className="admin-primary"
                      onClick={handleSavePlayerPin}
                      disabled={pinSaving || pinValue.length !== 4}
                    >
                      {pinSaving ? 'Opslaan...' : 'Opslaan'}
                    </button>
                    <button
                      className="admin-secondary"
                      onClick={() => {
                        setPinPlayer(null)
                        setPinValue('')
                      }}
                      disabled={pinSaving}
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              </div>
            )}

            {qrDataUrl && qrPlayer && (
              <div
                onClick={() => {
                  setQrDataUrl('')
                  setQrPlayer(null)
                  setQrUrl('')
                }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.65)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                }}
              >
                <div
                  className="admin-section-card"
                  onClick={event => event.stopPropagation()}
                  style={{
                    background: 'white',
                    color: '#25231f',
                    padding: '2rem',
                    borderRadius: '8px',
                    width: '420px',
                    maxWidth: '100%',
                    textAlign: 'center',
                  }}
                >
                  <h3>Toegang voor {qrPlayer.name || 'speler'}</h3>

                  <img
                    src={qrDataUrl}
                    alt={`QR-code voor ${qrPlayer.name || 'speler'}`}
                    style={{
                      width: '320px',
                      maxWidth: '100%',
                      display: 'block',
                      margin: '1rem auto',
                    }}
                  />

                  <p className="admin-help">
                    Deze QR-code gebruikt de vaste persoonlijke toegang
                    van de speler. De link blijft hetzelfde totdat we
                    hem bewust wijzigen.
                  </p>

                  <input
                    value={qrUrl}
                    readOnly
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: '0.5rem',
                    }}
                  />

                  <button
                    className="admin-primary"
                    style={{ marginTop: '1rem' }}
                    onClick={() => {
                      setQrDataUrl('')
                      setQrPlayer(null)
                      setQrUrl('')
                    }}
                  >
                    Sluiten
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

{section === 'affaires' && (
  <section className="admin-card">
    <h2>Affaires</h2>

    <label htmlFor="affaire-select">Selecteer een Affaire</label>

    <select
      id="affaire-select"
      value={selectedAffaireId || ''}
      onChange={(e) => {
        const affaireId = e.target.value || null
        setSelectedAffaireId(affaireId)
        loadAffaireAccess(affaireId)
      }}
    >
      <option value="">Kies een Affaire...</option>

      {affaires.map(affaire => (
        <option key={affaire.id} value={affaire.id}>
          {affaire.name}
        </option>
      ))}
    </select>

    {selectedAffaireId && (
      <div className="admin-section-card">
        <h3>Spelertoegang</h3>

        {players.length === 0 ? (
          <p className="admin-muted">Geen spelers gevonden.</p>
        ) : (
          players.map(player => {
            const restricted = affaireAccess.some(
              access =>
                access.player_id === player.id &&
                access.available === false
            )

            return (
              <label key={player.id} className="admin-access-row">
                <span>{player.name}</span>

                <input
                  type="checkbox"
                  checked={!restricted}
                  onChange={async (e) => {
                    try {
                      await setPlayerAffaireAccess(
                        adminSessionToken,
                        player.id,
                        selectedAffaireId,
                        e.target.checked
                      )

                      await loadAffaireAccess(selectedAffaireId)
                    } catch (err) {
                      console.error(err)
                      setError(
                        err.message ||
                        'Toegang kon niet worden gewijzigd.'
                      )
                    }
                  }}
                />

                <small>{restricted ? 'Geen toegang' : 'Toegang'}</small>
              </label>
            )
          })
        )}
      </div>
    )}
  </section>
)}
      </main>
    </div>
  )
}

export default AdminPanel
