import { useEffect, useState } from 'react'
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Browse from './pages/Browse'
import Stats from './pages/Stats'
import Admin from './pages/Admin'
import SignIn from './pages/SignIn'
import Upgrade from './pages/Upgrade'
import { GuideIndex, GuideRW, GuideSkillPage } from './pages/Guide'
import { RequireAdmin } from './components/AuthGate'
import { RequirePremium } from './components/Paywall'
import { signOut, useAuth, usePremium } from './lib/auth'
import { useProgressSync } from './lib/sync'
import { PrankScreen } from './components/PrankScreen'

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
  const { loading, premium } = usePremium()
  useProgressSync()
  if (user?.prank) return <PrankScreen />
  return (
    <HashRouter>
      <nav className="topnav">
        <NavLink to="/" className="brand" aria-label="SATisEZ home">
          <LogoMark />
          <span className="brand-word">SATis<span className="brand-ez">EZ</span></span>
        </NavLink>
        <div className="nav-links">
          <NavLink to="/practice">Practice</NavLink>
          <NavLink to="/browse">Browse</NavLink>
          <NavLink to="/stats">Progress</NavLink>
          <NavLink to="/guide">Guide</NavLink>
          {user?.admin && <NavLink to="/admin">Admin</NavLink>}
          {!loading && !premium && <NavLink to="/upgrade" className="nav-upgrade">Premium</NavLink>}
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
        <Route path="/practice" element={<Practice />} />
        <Route path="/browse" element={<RequirePremium reason="Browsing and searching the whole question bank is part of Premium. Free accounts get five questions a day on the Practice page."><Browse /></RequirePremium>} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/guide" element={<RequirePremium reason={GUIDE_REASON}><GuideIndex /></RequirePremium>} />
        <Route path="/guide/rw" element={<RequirePremium reason={GUIDE_REASON}><GuideRW /></RequirePremium>} />
        <Route path="/guide/rw/:slug" element={<RequirePremium reason={GUIDE_REASON}><GuideSkillPage /></RequirePremium>} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
      </Routes>
    </HashRouter>
  )
}

const GUIDE_REASON = 'The study guide — how the test is built and a step-by-step method for every question type — is for Premium members.'

function AccountMenu() {
  const { loading, user, configured } = useAuth()
  const [open, setOpen] = useState(false)
  if (loading || !configured) return null
  if (!user) return <div className="nav-account"><Link className="signin-link" to="/signin">Sign in</Link></div>
  return (
    <div className="nav-account">
      <button className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-label="Account" aria-expanded={open}>
        {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-fallback">{user.name[0]}</span>}
      </button>
      {open && (
        <div className="account-pop" onMouseLeave={() => setOpen(false)}>
          <div className="account-name">{user.name}</div>
          <div className="muted small">{user.email}</div>
          {user.admin && <div className="small account-role">Admin</div>}
          {user.premium && !user.admin && (
            <div className="small account-role">Premium{user.premiumUntil ? ` until ${new Date(user.premiumUntil).toLocaleDateString()}` : ''}</div>
          )}
          {!user.premium && <Link className="small account-upgrade" to="/upgrade" onClick={() => setOpen(false)}>Upgrade to Premium</Link>}
          <button onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  )
}

/** The SATisEZ mark: a filled-in answer bubble with a check. The tile follows the text colour,
 * so it's black in light mode and off-white in dark mode; the bubble and check stay the same. */
const LogoMark = () => (
  <svg className="brand-mark" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="currentColor" />
    <circle cx="32" cy="32" r="19.5" fill="#FFD23F" />
    <path d="M22.5 32.5l6.5 6.5 13-13.5" fill="none" stroke="#161616" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

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
