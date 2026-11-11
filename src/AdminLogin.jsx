
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-api',
        {
          body: {
            action: 'login',
            email,
            password,
          },
        }
      )

      if (error) throw error

      if (!data?.authenticated || !data?.sessionToken) {
        throw new Error('Ongeldige inloggegevens')
      }

      onLogin(data.sessionToken)
    } catch (err) {
      console.error('Admin login mislukt:', err)
      setError(
        'Inloggen mislukt. Controleer je e-mailadres en wachtwoord.'
      )
    } finally {
      setLoading(false)
      setPassword('')
    }
  }

  return (
    <main className="admin-login">
      <h1>Res Politica</h1>
      <h2>Beheerder login</h2>

      <form onSubmit={handleLogin}>
        <label htmlFor="admin-email">E-mailadres</label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="admin-password">Wachtwoord</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Bezig met inloggen…' : 'Inloggen'}
        </button>
      </form>
    </main>
  )
}
