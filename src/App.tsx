import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Browse from './pages/Browse'
import Stats from './pages/Stats'

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
  return (
    <HashRouter>
      <nav className="topnav">
        <NavLink to="/" className="brand">SATisEZ</NavLink>
        <NavLink to="/practice">Practice</NavLink>
        <NavLink to="/browse">Browse</NavLink>
        <NavLink to="/stats">Progress</NavLink>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/stats" element={<Stats />} />
      </Routes>
    </HashRouter>
  )
}
