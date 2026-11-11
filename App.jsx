import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './supabaseClient'
import AdminPanel from './AdminPanel'
import AdminLogin from './AdminLogin'
import { 
  getChronicles, 
  getAffairePosts, 
  addAffairePost, 
  getPlayerEntities, 
  getPlayerCuriosa, 
  addPlayerCuriosa, 
  removePlayerCuriosa, 
  getPlayerAffaires,
  createPlayerAffaire,  
  getPlayerCharacter, 
  getEntityText, 
  clearContentCache,
  authenticatePlayer, 
  markEntityViewed, 
  markAffaireViewed 
} from "./data";



function PageHeader({
  type,
  title,
  subtitle,
  item,
  curiosa,
  onToggleCuriosa,
}) {
  const isInCuriosa = curiosa.includes(item)

  return (
    <header className="entity-header">
      <button
        className={`star-button ${isInCuriosa ? 'selected' : ''}`}
        onClick={() => onToggleCuriosa(item)}
        title={isInCuriosa ? 'In Curiosa' : 'Toevoegen aan Curiosa'}
        aria-label={
          isInCuriosa
            ? 'Verwijderen uit Curiosa'
            : 'Toevoegen aan Curiosa'
        }
      >
        {isInCuriosa ? '★' : '☆'}
      </button>

      <div className="entity-type">{type}</div>

      <h1>{title}</h1>

      {subtitle && (
        <div className="entity-subtitle">{subtitle}</div>
      )}
    </header>
  )
}


function OrnamentalDivider({ type }) {
    console.log('Ornament aangeroepen:', type);
  const ornaments = {
    karakter: '/Ornaments/karakter.png',
    familie: '/Ornaments/familie.png',
    stam: '/Ornaments/familie.png',
    soort: '/Ornaments/familie.png',
    instituut: '/Ornaments/instituut.png',
    instituut2: '/Ornaments/instituut2.png',
    plateau: '/Ornaments/plateau.png',
    kroniek: '/Ornaments/kroniek.png',
    groep: '/Ornaments/groep.png',
    persoon: '/Ornaments/persoon.png',
    godheid: '/Ornaments/persoon.png',
    concept: '/Ornaments/concept.png',
    plek: '/Ornaments/plek.png',
    gebeurtenis: '/Ornaments/gebeurtenis.png',
    affaire: '/Ornaments/affaire.png',
    affaire2: '/Ornaments/affaire2.png',
    header: '/Ornaments/header.png',
  };

  const src = ornaments[type];
  console.log('Afbeeldingspad:', src);
    if (!src) return null;

  return (
    <div className="ornamental-divider">
      <img src={src} alt="" aria-hidden="true" />
    </div>
  );
}

function App() {

  const [activePage, setActivePage] = useState(null)
  const [activePopup, setActivePopup] = useState(null)
  const [playerEntities, setPlayerEntities] = useState([])
  const [playerCuriosa, setPlayerCuriosa] = useState([])
  const [playerAffaires, setPlayerAffaires] = useState([])
  const [activeEntity, setActiveEntity] = useState(null)
  const [activePopupEntity, setActivePopupEntity] = useState(null)
  const [entityText, setEntityText] = useState([])
  const [popupEntityText, setPopupEntityText] = useState([])
  const [playerCharacter, setPlayerCharacter] = useState(null)
  const [chronicles, setChronicles] = useState([])
  const [chroniclesOpen, setChroniclesOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [accessToken, setAccessToken] = useState(null)
  const [currentPlayer, setCurrentPlayer] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [adminSessionToken, setAdminSessionToken] = useState(() =>
  window.location.pathname.split('/')[1] === 'beheer'
    ? sessionStorage.getItem('res-politica-admin-session')
    : null
)

const [isAdminSessionChecking, setIsAdminSessionChecking] = useState(() =>
  window.location.pathname.split('/')[1] === 'beheer'
)

const [isAdminRoute, setIsAdminRoute] = useState(() =>
  window.location.pathname.split('/')[1] === 'beheer'
)

  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    const pathParts = window.location.pathname.split('/')
if (pathParts[1] === 'beheer') {
  setIsAdminRoute(true)
}
    if (pathParts[1] === 'p' && pathParts[2]) {
      setAccessToken(pathParts[2])
    }

  }, [])

useEffect(() => {
  if (!isAdminRoute) return

  const storageKey = 'res-politica-admin-session'
  const storedToken = sessionStorage.getItem(storageKey)

  if (!storedToken) {
    setAdminSessionToken(null)
    setIsAdminSessionChecking(false)
    return
  }

  let mounted = true

  const verifyAdminSession = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-api',
        {
          body: {
            action: 'verify',
            sessionToken: storedToken,
          },
        }
      )

      if (error) throw error

      if (!mounted) return

      if (data?.authenticated) {
        setAdminSessionToken(storedToken)
      } else {
        sessionStorage.removeItem(storageKey)
        setAdminSessionToken(null)
      }
    } catch (error) {
      console.error('Herstellen beheerderssessie mislukt:', error)

      if (!mounted) return

      sessionStorage.removeItem(storageKey)
      setAdminSessionToken(null)
    } finally {
      if (mounted) {
        setIsAdminSessionChecking(false)
      }
    }
  }

  verifyAdminSession()

  return () => {
    mounted = false
  }
}, [isAdminRoute])

  console.log('ACCESS TOKEN:', accessToken)

  useEffect(() => {
    if (!accessToken) return
    try {
      setIsAuthenticated(sessionStorage.getItem(`res-politica-authenticated:${accessToken}`) === 'true')
    } catch (error) {
      console.warn('Sessie kon niet worden hersteld:', error)
    }
  }, [accessToken])

  // Beheer meldt wijzigingen via localStorage; het storage-event wordt in andere tabbladen ontvangen.
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'res-politica-entity-updated' && event.newValue) {
        clearContentCache()
        setRefreshVersion(version => version + 1)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

useEffect(() => {
  if (!isAdminRoute || isAdminSessionChecking || !adminSessionToken) {
    return
  }

  getChronicles(adminSessionToken)
    .then(data => {
      setChronicles(data)
    })
    .catch(error => {
      console.error('Fout bij laden kronieken:', error)
    })
}, [refreshVersion, isAdminRoute, isAdminSessionChecking, adminSessionToken])



useEffect(() => {
  const restorePlayerSession = async () => {
    if (!accessToken) return

    const storageKey = `res-politica-session:${accessToken}`
    const sessionToken = sessionStorage.getItem(storageKey)

    if (!sessionToken) return

    try {
      const { data, error } = await supabase.functions.invoke(
        'player-session',
        {
          body: { sessionToken },
        }
      )

      if (error) throw error

      if (data?.valid && data.player) {
        setCurrentPlayer(data.player)
        setIsAuthenticated(true)
      } else {
        sessionStorage.removeItem(storageKey)
      }
    } 
    catch (error) {
      console.error('Herstellen spelerssessie mislukt:', error)
      sessionStorage.removeItem(storageKey)
    }
  }

  restorePlayerSession()
}, [accessToken])


useEffect(() => {
  const loadCharacter = async () => {
    if (!currentPlayer || !isAuthenticated || !accessToken) return

    const sessionToken = sessionStorage.getItem(
      `res-politica-session:${accessToken}`
    )

    if (!sessionToken) return

    try {
      const character = await getPlayerCharacter(sessionToken)

      if (character) {
        setPlayerCharacter(character)
        openEntity(character)
      }
    } catch (error) {
      console.error('Fout bij laden karakter:', error)
    }
  }

  loadCharacter()
}, [currentPlayer, isAuthenticated, accessToken])



useEffect(() => {
  if (!currentPlayer || !accessToken) return

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) return

  getPlayerEntities(sessionToken)
    .then(data => {
      console.log('Speler uit Supabase:', data)
      setPlayerEntities(data)

      const refreshedEntities = (data || [])
        .map(row => row.entities)
        .filter(Boolean)

      setPlayerCharacter(current => current
        ? refreshedEntities.find(item => item.id === current.id) || current
        : current)

      setActiveEntity(current => current
        ? refreshedEntities.find(item => item.id === current.id) || current
        : current)

      setActivePopupEntity(current => current
        ? refreshedEntities.find(item => item.id === current.id) || current
        : current)
    })
    .catch(error => {
      console.error('Fout bij laden speler-entiteiten:', error)
    })
}, [currentPlayer, refreshVersion, accessToken])


useEffect(() => {
  if (!activeEntity || !currentPlayer || !accessToken) return

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) return

  let cancelled = false
  setEntityText([])

  getEntityText(sessionToken, activeEntity.id)
    .then(data => {
      if (cancelled) return
      console.log('Tekst van actieve entity:', data)
      setEntityText(data)
    })
    .catch(error => {
      if (cancelled) return
      console.error('Fout bij ophalen entity-tekst:', error)
    })

  return () => {
    cancelled = true
  }
}, [activeEntity, currentPlayer, refreshVersion, accessToken])



useEffect(() => {
  if (!activePopupEntity) {
    setPopupEntityText([])
    return
  }

  if (!currentPlayer || !accessToken) return

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) return

  let cancelled = false
  setPopupEntityText([])

  getEntityText(sessionToken, activePopupEntity.id)
    .then(data => {
      if (!cancelled) setPopupEntityText(data)
    })
    .catch(error => {
      if (cancelled) return
      console.error('Fout bij ophalen popup entity-tekst:', error)
      setPopupEntityText([])
    })

  return () => {
    cancelled = true
  }
}, [activePopupEntity, currentPlayer, refreshVersion, accessToken])





  
useEffect(() => {
  if (!currentPlayer || !accessToken) return

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) return

  getPlayerCuriosa(sessionToken)
    .then(data => {
      console.log('Speler Curiosa uit Supabase:', data)

      setPlayerCuriosa(data)

      const itemKeys = data.map(row => row.entity_id)
      setCuriosa(itemKeys)
    })
    .catch(error => {
      console.error('Fout bij ophalen Curiosa:', error)
    })
}, [currentPlayer, refreshVersion, accessToken])


  // CURIOsa
  const [curiosa, setCuriosa] = useState([])
  const [curiosaOpen, setCuriosaOpen] = useState(false)

  // AFFAIRES
  const [affairesOpen, setAffairesOpen] = useState(false)
  const [activeAffaire, setActiveAffaire] = useState(null)
  const [affaires, setAffaires] = useState([])
  const [affairePosts, setAffairePosts] = useState([])
  const [showNewAffaire, setShowNewAffaire] = useState(false)
  const [newAffaireName, setNewAffaireName] = useState('')
  const [newAffaireSubtitle, setNewAffaireSubtitle] = useState('')



const toggleCuriosa = async (item) => {
  const entityRow = playerEntities.find(
    row => row.entity_id === item
  )

  if (!entityRow?.entities) {
    console.error('Entity niet gevonden:', item)
    return
  }

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) {
    console.error('Geen actieve spelerssessie gevonden')
    return
  }

  // Reageer onmiddellijk in de interface; de serveropslag loopt op de achtergrond.
  const alreadyInCuriosa = curiosa.includes(item)
  const previousCuriosa = playerCuriosa
  const previousKeys = curiosa

  if (alreadyInCuriosa) {
    setCuriosa(previousKeys.filter(id => id !== item))
    setPlayerCuriosa(previousCuriosa.filter(row => row.entity_id !== item))
  } else {
    setCuriosa([...previousKeys, item])
    setPlayerCuriosa([
      {
        entity_id: item,
        entities: entityRow.entities,
      },
      ...previousCuriosa,
    ])
  }

  try {
    if (alreadyInCuriosa) {
      await removePlayerCuriosa(sessionToken, item)
      console.log('Verwijderd uit Curiosa:', item)
    } else {
      await addPlayerCuriosa(sessionToken, item)
      console.log('Toegevoegd aan Curiosa:', item)
    }
  } catch (error) {
    // Herstel de vorige weergave als opslaan mislukt.
    setPlayerCuriosa(previousCuriosa)
    setCuriosa(previousKeys)
    console.error('Fout bij wijzigen Curiosa:', error)
  }
}

  const openEntity = (entity) => {
    if (!entity) return
    console.log('OPEN ENTITY:', entity)

    // Verwijder de inhoud van de vorige pagina direct bij navigatie.
    setEntityText([])
    setPopupEntityText([])

if (currentPlayer) {
  const viewedAt = new Date().toISOString()

  // Meteen lokaal als gezien markeren
  setPlayerEntities(prev =>
    prev.map(row =>
      row.entity_id === entity.id
        ? {
            ...row,
            viewed_at: viewedAt
          }
        : row
    )
  )

// Daarna permanent opslaan in Supabase
const storageKey = `res-politica-session:${accessToken}`
const sessionToken = sessionStorage.getItem(storageKey)

if (sessionToken) {
  markEntityViewed(sessionToken, entity.id)
    .catch(error => {
      console.error('Fout bij markeren entity als gezien:', error)
    })
}}
 // Entiteiten die als popup openen,
    // komen niet in de navigatiegeschiedenis.
if (
  entity.type === 'persoon' ||
  entity.type === 'concept' ||
  entity.type === 'godheid' ||
  entity.type === 'gebeurtenis' ||
  entity.type === 'plek'
) {
  setActivePopupEntity(entity)
  setActivePopup('entity')
  return
}
    let page = null
    if (
      entity.type === 'familie' ||
      entity.type === 'stam' ||
      entity.type === 'soort' ||
      entity.type === 'organisatie' ||
      entity.type === 'factie'
    ) {
      page = 'groep'
    }
    if (
      entity.type === 'instituut' ||
      entity.type === 'plateau'
    ) {
      page = 'instituut'
    }
    if (
      entity.type === 'hoofdstad' ||
      entity.type === 'vrijstad' ||
      entity.type === 'stad' ||
      entity.type === 'plaats'
    ) {
      page = 'plaats'
    }
    if (entity.type === 'kroniek') {
      page = 'kroniek'
    }
    if (entity.type === 'karakter') {
      page = 'karakter'
    }
    if (!page) {
      return
    }
    const newLocation = {
      page,
      entity
    }

    setActivePopup(null)
    setActiveEntity(entity)
    setActivePage(page)

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)

      // Voorkom dubbele pagina's achter elkaar
      const currentLocation = newHistory[newHistory.length - 1]

      if (
        currentLocation?.page === newLocation.page &&
        currentLocation?.entity?.id === newLocation.entity?.id
      ) {
        return newHistory
      }

      return [...newHistory, newLocation]
    })

    setHistoryIndex(prev => prev + 1)
  }


  const goBack = () => {
    if (historyIndex <= 0) return

    const previous = history[historyIndex - 1]

    setEntityText([])
    setAffairePosts([])
    setHistoryIndex(historyIndex - 1)
    setActivePopup(null)

    if (previous.page === 'affaire') {
      setActiveAffaire(previous.affaireId)
      setActivePage('affaire')
      return
    }

    setActivePage(previous.page)
    setActiveEntity(previous.entity)
  }


  const goForward = () => {
    if (historyIndex >= history.length - 1) return

    const next = history[historyIndex + 1]

    setEntityText([])
    setAffairePosts([])
    setHistoryIndex(historyIndex + 1)
    setActivePopup(null)

    if (next.page === 'affaire') {
      setActiveAffaire(next.affaireId)
      setActivePage('affaire')
      return
    }

    setActivePage(next.page)
    setActiveEntity(next.entity)
  }


  const openCuriosaItem = (item) => {
    const entity = playerCuriosa.find(
      row => row.entity_id === item
    )?.entities

    if (entity) {
      openEntity(entity)
      setCuriosaOpen(false)
    }
  }

  /*
   * AFFAIRE OPENEN
   */
  const openAffaire = (affaireId) => {
    setEntityText([])
    setAffairePosts([])

    const newLocation = {
      page: 'affaire',
      affaireId
    }

    setAffairesOpen(false)
    setActiveAffaire(affaireId)
    setActivePage('affaire')
    setActivePopup(null)

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)

      const currentLocation = newHistory[newHistory.length - 1]

      if (
        currentLocation?.page === newLocation.page &&
        currentLocation?.affaireId === newLocation.affaireId
      ) {
        return newHistory
      }

      return [...newHistory, newLocation]
    })

    setHistoryIndex(prev => prev + 1)
  }

const toggleAffaires = async () => {
  if (!currentPlayer || !accessToken) return

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) {
    console.error('Geen actieve spelerssessie gevonden')
    return
  }

  if (!affairesOpen) {
    try {
      const data = await getPlayerAffaires(sessionToken)
      setAffaires(data)
    } catch (error) {
      console.error('Fout bij verversen Affaires:', error)
      return
    }
  }

  setAffairesOpen(prev => !prev)
}

const handleCreateAffaire = async () => {
  if (!currentPlayer || !accessToken) return

  const name = newAffaireName.trim()
  const subtitle = newAffaireSubtitle.trim()

  if (!name || name.length > 20 || subtitle.length > 50) {
    return
  }

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) {
    console.error('Geen actieve spelerssessie gevonden')
    return
  }

  try {
    await createPlayerAffaire(sessionToken, name, subtitle)

    // Ververs de lijst met Affaires.
    const data = await getPlayerAffaires(sessionToken)
    setAffaires(data)

    // Maak het formulier weer leeg en sluit het.
    setNewAffaireName('')
    setNewAffaireSubtitle('')
    setShowNewAffaire(false)

  } catch (error) {
    console.error('Fout bij aanmaken Affaire:', error)
    alert('De Affaire kon niet worden aangemaakt. Probeer het opnieuw.')
  }
}

  /*
   * NIEUWE BIJDRAGE
   */
  const addContribution = (affaireId, text) => {
    if (!text.trim()) return

    const today = new Date()

    const date = today.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })


  }

  const renderAffaireText = (text) => {
    if (!text) return null

    const entityRows = playerEntities
      .filter(row => row.entities)
      .sort((a, b) =>
        b.entities.name.length - a.entities.name.length
      )
    if (entityRows.length === 0) {
      return text
    }
  

  const escapedNames = entityRows.map(row =>
    row.entities.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )


const regex = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${escapedNames.join('|')})(?![\\p{L}\\p{N}_])`,
  'giu'
)

  const parts = text.split(regex)

  return parts.map((part, index) => {
    const entityRow = entityRows.find(
      row =>
        row.entities.name.toLowerCase() === part.toLowerCase()
    )

    const entity = entityRow?.entities

    if (!entity) {
      return <span key={index}>{part}</span>
    }


    return (
      <button
        key={index}
        className={`affaire-entity-link ${entityRow?.viewed_at ? '' : 'unseen'
          }`}
        type="button"
        onClick={() => openEntity(entity)}
      >
        {part}
      </button>
    )
  })
}

const currentAffaire = affaires.find(
  (affaire) => affaire.id === activeAffaire
)

useEffect(() => {
  if (!activeAffaire || !currentPlayer || !accessToken) return

  const sessionToken = sessionStorage.getItem(
    `res-politica-session:${accessToken}`
  )

  if (!sessionToken) return

  const viewedAt = new Date().toISOString()

  setAffairePosts([])

  setAffaires(prev =>
    prev.map(item =>
      item.id === activeAffaire
        ? { ...item, viewed_at: viewedAt }
        : item
    )
  )

  markAffaireViewed(sessionToken, activeAffaire)
    .catch(error => {
      console.error('Fout bij markeren affaire als gezien:', error)
    })

  getAffairePosts(sessionToken, activeAffaire)
    .then(data => {
      console.log('Posts van Affaire uit Supabase:', data)
      setAffairePosts(data)
    })
    .catch(error => {
      console.error('Fout bij ophalen Affaire-posts:', error)
    })
}, [activeAffaire, currentPlayer, accessToken])



const handleAccessCode = async () => {
  if (!accessToken || !accessCode) return

  try {
    const result = await authenticatePlayer(accessToken, accessCode)

    if (!result?.sessionToken || !result?.player) {
      alert('Inloggen mislukt. Controleer je pincode.')
      return
    }

    const storageKey = `res-politica-session:${accessToken}`

    sessionStorage.setItem(storageKey, result.sessionToken)

    setCurrentPlayer(result.player)
    setIsAuthenticated(true)
    setAccessCode('')
  } catch (error) {
    console.error('Fout bij inloggen:', error)
    alert('Inloggen mislukt. Controleer je pincode of probeer het later opnieuw.')
  }
}


if (isAdminRoute) {
  if (isAdminSessionChecking) {
    return (
      <main className="admin-login">
        <h1>Res Politica</h1>
        <p>Beheerderssessie controleren...</p>
      </main>
    )
  }

  if (adminSessionToken) {
    return (
<AdminPanel
  adminSessionToken={adminSessionToken}
  onExit={async () => {
              try {
            const { error } = await supabase.functions.invoke(
              'admin-api',
              {
                body: {
                  action: 'logout',
                  sessionToken: adminSessionToken,
                },
              }
            )

            if (error) throw error

            sessionStorage.removeItem('res-politica-admin-session')
            setAdminSessionToken(null)
            setIsAdminRoute(false)
            window.history.pushState({}, '', '/')
          } catch (error) {
            console.error('Uitloggen mislukt:', error)
            alert('Uitloggen is niet gelukt. Probeer het opnieuw.')
          }
        }}
      />
    )
  }

  return (
    <AdminLogin
      onLogin={(sessionToken) => {
        sessionStorage.setItem(
          'res-politica-admin-session',
          sessionToken
        )
        setAdminSessionToken(sessionToken)
      }}
    />
  )
}

if (!accessToken) {
  return (
    <main className="login-page">
      <div className="login-box">

        <div className="site-title">
          RES POLITICA
        </div>

        <p>
          Deze website is alleen toegankelijk via een persoonlijke link.
        </p>

      </div>
    </main>
  )
}

if (accessToken && !isAuthenticated) {
  return (
    <main className="login-page">
      <div className="login-box">

        <div className="site-title">
          RES POLITICA
        </div>


          <>
            <p>Voer je pincode in om verder te gaan.</p>

            <input
              type="password"
              inputMode="numeric"
              placeholder="Pincode"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAccessCode()
                }
              }}
              autoFocus
            />

            <button onClick={handleAccessCode}>
              Verder
            </button>
          </>

      </div>
    </main>
  )
}

return (
  <div className="app">
    {/* HEADER */}


<header className="site-header">
  <div className="site-banner">
    <img
      src="/images/res-politica-banner.png"
      alt=""
      className="site-banner-image"
    />

    <button
      className="site-title site-title-button"
      onClick={() => openEntity(playerCharacter)}
      type="button"
      aria-label="Res Politica — naar je personage"
    >
      Res Politica
    </button>

    <nav className="main-nav">
        <div className="curiosa-menu">

          <button
            className={curiosaOpen ? 'active' : ''}
            onClick={() => {
              setCuriosaOpen(!curiosaOpen)
              setAffairesOpen(false)
            }}
          >
            Curiosa
          </button>


          {curiosaOpen && (
            <div className="curiosa-dropdown">

              {curiosa.length === 0 ? (

                <div className="curiosa-empty">
                  Nog niets bewaard
                </div>

              ) : (

                curiosa.map((item) => {
                  const entity = playerCuriosa.find(
                    row => row.entity_id === item
                  )?.entities

                  const title = entity?.name
                  const access = playerEntities.find(
                  row => row.entity_id === item
                )

                const unseen = !access?.viewed_at
                  if (!title) return null

                  return (
                    <button
                      key={item}
                      className={`curiosa-item ${unseen ? 'unseen' : ''}`}
                      onClick={() => openCuriosaItem(item)}
                    >
                      <span className="curiosa-item-title">
                        {title}
                      </span>
                    </button>
                  )
                })
              )}

            </div>
          )}

        </div>
<div className="chronicles-menu">
  <button
    className={chroniclesOpen ? 'active' : ''}
    onClick={() => {
      setChroniclesOpen(!chroniclesOpen)
      setCuriosaOpen(false)
      setAffairesOpen(false)
    }}
  >
    Kronieken
  </button>

  {chroniclesOpen && (
    <div className="chronicles-dropdown">
      {chronicles.length === 0 ? (
        <div className="curiosa-empty">
          Nog geen kronieken
        </div>
      ) : (
        chronicles.map(chronicle => (
          <button
            key={chronicle.id}
            className="curiosa-item"
            onClick={() => {
              openEntity(chronicle)
              setChroniclesOpen(false)
            }}
          >
            <span className="curiosa-item-title">
              {chronicle.name}
            </span>
          </button>
        ))
      )}
    </div>
  )}
</div>
<div className="affaires-menu">

  <button
    className={affairesOpen ? 'active' : ''}
    onClick={() => {
      toggleAffaires()
      setCuriosaOpen(false)
    }}
  >
    Affaires
  </button>

  {affairesOpen && (
    <div className="affaires-dropdown">

      {affaires.map((affaire) => (
        <button
          key={affaire.id}
          className={`affaire-menu-item ${
            !affaire.viewed_at ||
            new Date(affaire.updated_at) > new Date(affaire.viewed_at)
              ? 'unseen'
              : ''
          }`}
          onClick={() => openAffaire(affaire.id)}
        >
          {affaire.name}
        </button>
      ))}

      <div className="affaire-dropdown-divider"></div>

      {!showNewAffaire ? (
        <button
          className="affaire-menu-item new-affaire-button"
          onClick={() => setShowNewAffaire(true)}
        >
          + Affaire
        </button>
      ) : (
        <div className="new-affaire-form">

          <input
            type="text"
            placeholder="Naam (max. 20 tekens)"
            maxLength={20}
            value={newAffaireName}
            onChange={(e) => setNewAffaireName(e.target.value)}
          />

          <input
            type="text"
            placeholder="Subtitel (max. 50 tekens)"
            maxLength={50}
            value={newAffaireSubtitle}
            onChange={(e) => setNewAffaireSubtitle(e.target.value)}
          />

          <div className="new-affaire-actions">
            <button
              onClick={handleCreateAffaire}
              disabled={!newAffaireName.trim()}
            >
              Aanmaken
            </button>

            <button
              onClick={() => {
                setShowNewAffaire(false)
                setNewAffaireName('')
                setNewAffaireSubtitle('')
              }}
            >
              Annuleren
            </button>
          </div>

        </div>
      )}

    </div>
  )}

</div>    </nav>
  </div>
</header>

  <div className="page-background">

    {/* KRONIEK */}

    {activePage === 'kroniek' && activeEntity && (
      <main className="content">

        <article className="chronicle">

          <div className="page-navigation">
            <button
              onClick={goBack}
              disabled={historyIndex <= 0}
            >
              ← Terug
            </button>

            <button
              onClick={goForward}
              disabled={historyIndex >= history.length - 1}
            >
              Vooruit →
            </button>
          </div>

          <PageHeader
            type={activeEntity.type}
            title={activeEntity.name}
            subtitle={activeEntity.subtitle}
            item={activeEntity.id}
            curiosa={curiosa}
            onToggleCuriosa={toggleCuriosa}
          />
<OrnamentalDivider type={activeEntity.type} />

<div className="page-body chronicle-page-body">
  {entityText.map((block, index) => (
<>
      <p>
        {renderAffaireText(block.content)}
      </p>

      {index < entityText.length - 1 && (
        <div className="chronicle-divider" aria-hidden="true">
          <img src="/Ornaments/kroniek2.png" alt="" />
        </div>
      )}
</>
  ))}
</div>

        </article>

      </main>
    )}

    {/* POPUP */}
    {activePopup === 'entity' && activePopupEntity && (
      <div
        className="popup-backdrop"
        onClick={() => setActivePopup(null)}
      >
        <section
          className="popup"
          onClick={(event) => event.stopPropagation()}
        >

          <button
            className="popup-close"
            onClick={() => setActivePopup(null)}
            aria-label="Sluiten"
          >
            ×
          </button>

          <PageHeader
            type={activePopupEntity.type}
            title={activePopupEntity.name}
            subtitle={activePopupEntity.subtitle}
            item={activePopupEntity.id}
            curiosa={curiosa}
            onToggleCuriosa={toggleCuriosa}
          />
<OrnamentalDivider type={activePopupEntity.type} />
{activePopupEntity.image_url && (
              <div className="popup-image">
              <img
                src={activePopupEntity.image_url}
                decoding="async"
                alt={activePopupEntity.name}
              />
            </div>
          )}

<div className="page-body">
  {popupEntityText.length > 0 ? (
    popupEntityText.map((block) => (
      <p key={block.id}>
        {renderAffaireText(block.content)}
      </p>
    ))
  ) : (
    <p>Entiteit wordt geladen...</p>
  )}
</div>
        </section>
      </div>
    )}

    {/* PLAATS */}

    {activePage === 'plaats' && activeEntity && (
      <main className="content">
        <article className="entity-page">

          <div className="page-navigation">
            <button
              onClick={goBack}
              disabled={historyIndex <= 0}
            >
              ← Terug
            </button>

            <button
              onClick={goForward}
              disabled={historyIndex >= history.length - 1}
            >
              Vooruit →
            </button>
          </div>

<div className="place-header">
  {activeEntity.image_url && (
    <img
      className="place-header-image"
      src={activeEntity.image_url}
      fetchPriority="high"
      decoding="async"
      alt=""
    />
  )}

  <div className="place-header-content">
    <PageHeader
      type={activeEntity.type}
      title={activeEntity.name}
      subtitle={activeEntity.subtitle}
      item={activeEntity.id}
      curiosa={curiosa}
      onToggleCuriosa={toggleCuriosa}
    />
  </div>
</div>


<div className="page-body chronicle-page-body">
  {entityText.map((block, index) => (
    <div key={block.id}>
      {block.block_type === 'bullet_list' ? (
        <ul>
          {block.content
            .split('\n')
            .filter(line => line.trim() !== '')
            .map((line, lineIndex) => (
              <li key={lineIndex}>
                {renderAffaireText(line)}
              </li>
            ))}
        </ul>
      ) : (
        <p>{renderAffaireText(block.content)}</p>
      )}

    </div>
  ))}
</div>
        </article>
      </main>
    )}

    {/* GROEP */}

    {activePage === 'groep' && activeEntity && (
      <main className="content">
        <article className="entity-page">

          <div className="page-navigation">
            <button
              onClick={goBack}
              disabled={historyIndex <= 0}
            >
              ← Terug
            </button>

            <button
              onClick={goForward}
              disabled={historyIndex >= history.length - 1}
            >
              Vooruit →
            </button>
          </div>

          <PageHeader
            type={activeEntity.type}
            title={activeEntity.name}
            subtitle={activeEntity.subtitle}
            item={activeEntity.id}
            curiosa={curiosa}
            onToggleCuriosa={toggleCuriosa}
          />
<OrnamentalDivider type={activeEntity.type} />
<div className="page-body group-portrait">
  {activeEntity.image_url && (
    <img
      className="group-crest"
      src={activeEntity.image_url}
      fetchPriority="high"
      decoding="async"
      alt={`Wapenschild van ${activeEntity.name}`}
    />
  )}



<div className="group-text">
  {entityText.map((block) => (
    <div key={block.id}>
      {block.block_type === 'genealogy_list' ? (
        <div className="genealogy-list">
          {block.content
            .split('\n')
            .filter(line => line.trim() !== '')
            .map((line, index) => {
              const level =
                (line.match(/^ */)?.[0].length || 0);

              return (
                <div
                  className="genealogy-list-item"
                  key={index}
style={{
  '--level': level
}}                >
                  {level > 0 && (
                    <span className="genealogy-marker">└ </span>
                  )}
                  {renderAffaireText(line.trim())}
                </div>
              );
            })}
        </div>
      ) : block.block_type === 'bullet_list' ? (
        <ul>
          {block.content
            .split('\n')
            .filter(line => line.trim() !== '')
            .map((line, index) => (
              <li key={index}>
                {renderAffaireText(line)}
              </li>
            ))}
        </ul>
      ) : (
        <p>{renderAffaireText(block.content)}</p>
      )}
    </div>
  ))}
</div>
</div>


        </article>
      </main>
    )}

    {/* KARAKTER */}

    {activePage === 'karakter' && activeEntity && (
      <main className="content">
        <article className="entity-page">
          <div className="page-navigation">
            <button
              onClick={goBack}
              disabled={historyIndex <= 0}
            >
              ← Terug
            </button>

            <button
              onClick={goForward}
              disabled={historyIndex >= history.length - 1}
            >
              Vooruit →
            </button>
          </div>

          <PageHeader
            type={activeEntity.type}
            title={activeEntity.name}
            subtitle={activeEntity.subtitle}
            item={activeEntity.id}
            curiosa={curiosa}
            onToggleCuriosa={toggleCuriosa}
          />
          <OrnamentalDivider type={activeEntity.type} />
          <div className="page-body">
<div className="page-body character-portrait">
  {activeEntity.image_url && (
    <img
      className="character-image"
      src={activeEntity.image_url}
      fetchPriority="high"
      decoding="async"
      alt={activeEntity.name}
    />
  )}

<div className="character-text">
  {entityText.map((block) => (
    <div key={block.id}>
      {block.block_type === 'bullet_list' ? (
        <ul>
          {block.content
            .split('\n')
            .filter(line => line.trim() !== '')
            .map((line, index) => (
              <li key={index}>
                {renderAffaireText(line)}
              </li>
            ))}
        </ul>
      ) : (
        <p>{renderAffaireText(block.content)}</p>
      )}
    </div>
  ))}
</div></div>      
          </div>
        </article>
      </main>
    )}




{/* INSTITUUT */}

{activePage === 'instituut' && activeEntity && (
  <main className="content">
    <article className="entity-page">

      <div className="page-navigation">
        <button
          onClick={goBack}
          disabled={historyIndex <= 0}
        >
          ← Terug
        </button>

        <button
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
        >
          Vooruit →
        </button>
      </div>

      <PageHeader
        type={activeEntity.type}
        title={activeEntity.name}
        subtitle={activeEntity.subtitle}
        item={activeEntity.id}
        curiosa={curiosa}
        onToggleCuriosa={toggleCuriosa}
      />
<OrnamentalDivider type="instituut" />

      {/* LEDENLIJST */}
      {entityText.some(
        block => block.block_type === 'institute_members'
      ) && (
        <section className="institute-members">


<div
  className="institute-members-columns"
  style={{
    gridTemplateColumns: `repeat(${Math.max(
      1,
      Math.min(
        3,
        entityText
          .filter(block => block.block_type === 'institute_members')
          .flatMap(block => block.content.split('\n'))
          .filter(line => line.trim() !== '').length
      )
    )}, max-content)`
  }}
>
  {entityText
    .filter(block => block.block_type === 'institute_members')
    .flatMap(block => block.content.split('\n'))
    .filter(line => line.trim() !== '')
    .map((line, index) => (
      <div className="institute-member" key={index}>
        {renderAffaireText(line)}
      </div>
    ))}
</div>
<OrnamentalDivider type="instituut2" />
        </section>
      )}



      {/* GEWONE TEKST */}
      <div className="page-body institute-page-body">
{(activeEntity.type === 'instituut' ||
  activeEntity.type === 'plateau') &&
  activeEntity.image_url && (
    <img
      className="institute-initial"
      src={activeEntity.image_url}
      fetchPriority="high"
      decoding="async"
      alt=""
      aria-hidden="true"
    />
  )}

{entityText
  .filter(
    block => block.block_type !== 'institute_members'
  )
  .map(block => (
    <div key={block.id}>
      {block.block_type === 'bullet_list' ? (
        <ul>
          {block.content
            .split('\n')
            .filter(line => line.trim() !== '')
            .map((line, index) => (
              <li key={index}>
                {renderAffaireText(line)}
              </li>
            ))}
        </ul>
      ) : (
        <p>{renderAffaireText(block.content)}</p>
      )}
    </div>
  ))}
      </div>

{activeEntity.type === 'plateau' &&
  activeEntity.name === 'Patrije' && (
    <div className="plateau-map">
      <a
        href="/images/patrijekaart.jpg"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src="/images/patrijekaart.jpg"
          alt="Kaart van Patrije"
        />
      </a>
    </div>
  )}


    </article>
  </main>
)}


    {/* AFFAIRE */}

    {activePage === 'affaire' && currentAffaire && (

      <main className="content">

        <article className="affaire-page">

          <div className="page-navigation">
            <button
              onClick={goBack}
              disabled={historyIndex <= 0}
            >
              ← Terug
            </button>

            <button
              onClick={goForward}
              disabled={historyIndex >= history.length - 1}
            >
              Vooruit →
            </button>
          </div>

<header className="entity-header">
  <div className="entity-type">Affaire</div>
  <h1>{currentAffaire.name}</h1>

  {currentAffaire.subtitle && (
    <p className="entity-subtitle">
      {currentAffaire.subtitle}
    </p>
  )}
</header>


          <OrnamentalDivider type="affaire" />

          <div className="affaire-contributions">
            {affairePosts.map((post) => (
              <div
                className="affaire-contribution"
                key={post.id}
              >
                <div className="affaire-meta">
                  {post.players?.name} — {new Date(post.created_at).toLocaleString('nl-NL', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </div>

                <div className="affaire-text">
                  {renderAffaireText(post.content)}
                </div>
                <OrnamentalDivider type="affaire2" />

              </div>
            ))}
            
          </div>


<div className="affaire-new-contribution">
              <textarea
              id="new-contribution"
              placeholder="Schrijf een nieuwe bijdrage..."
              rows="5"
            />

            <button
              onClick={async () => {
                const textarea =
                  document.getElementById('new-contribution')

                const text = textarea.value.trim()

                if (!text) return

                console.log('Nieuwe Affaire-post:', {
                  affaireId: currentAffaire.id,
                  playerId: currentPlayer.id,
                  text: text
                })

const storageKey = `res-politica-session:${accessToken}`
const sessionToken = sessionStorage.getItem(storageKey)

if (!sessionToken) {
  throw new Error('Geen geldige spelerssessie gevonden')
}

await addAffairePost(
  sessionToken,
  currentAffaire.id,
  text
)
const posts = await getAffairePosts(
  sessionToken,
  currentAffaire.id
)
                setAffairePosts(posts)

                textarea.value = ''
              }}
            >
              Bijdrage toevoegen
            </button>
          </div>

        </article>

      </main>

    )}
  </div>
    </div>

)
}

export default App