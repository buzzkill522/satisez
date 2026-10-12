import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Browse from './pages/Browse'
import Stats from './pages/Stats'
import Admin from './pages/Admin'
import { GuideIndex, GuideRW, GuideSkillPage } from './pages/Guide'
import { RequireAccess, RequireAdmin, GoogleButton } from './components/AuthGate'
import { signOut, useAuth } from './lib/auth'

type Theme = 'light' | 'dark'
const THEME_KEY = 'satisez.theme'

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable — theme just won't persist */
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const { user } = useAuth()
  return (
    <HashRouter>
      <nav className="topnav">
        <NavLink to="/" className="brand">SATis<span className="brand-ez">EZ</span></NavLink>
        <div className="nav-links">
          <NavLink to="/practice">Practice</NavLink>
          <NavLink to="/browse">Browse</NavLink>
          <NavLink to="/stats">Progress</NavLink>
          <NavLink to="/guide">Guide</NavLink>
          {user?.admin && <NavLink to="/admin">Admin</NavLink>}
        </div>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
        <AccountMenu />
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<RequireAccess><Practice /></RequireAccess>} />
        <Route path="/browse" element={<RequireAccess><Browse /></RequireAccess>} />
        <Route path="/stats" element={<RequireAccess><Stats /></RequireAccess>} />
        <Route path="/guide" element={<GuideIndex />} />
        <Route path="/guide/rw" element={<GuideRW />} />
        <Route path="/guide/rw/:slug" element={<GuideSkillPage />} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
      </Routes>
    </HashRouter>
  )
}

function AccountMenu() {
  const { loading, user, configured } = useAuth()
  const [open, setOpen] = useState(false)
  if (loading || !configured) return null
  if (!user) return <div className="nav-account"><GoogleButton /></div>
  return (
    <div className="nav-account">
      <button className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-label="Account" aria-expanded={open}>
        {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-fallback">{user.name[0]}</span>}
      </button>
      {open && (
        <div className="account-pop" onMouseLeave={() => setOpen(false)}>
          <div className="account-name">{user.name}</div>
          <div className="muted small">{user.email}</div>
          <div className="small account-role">{user.admin ? 'Admin' : user.access ? 'Question bank: on' : 'Waiting for access'}</div>
          <button onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  )
}

/* Line icons in Amanat's style: 2.5px strokes, round caps and joins, currentColor. */
const MoonIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
)
const SunIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
)
