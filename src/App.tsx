import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Browse from './pages/Browse'
import Stats from './pages/Stats'

export default function App() {
  return (
    <HashRouter>
      <nav className="topnav">
        <NavLink to="/" className="brand">SATisEZ</NavLink>
        <NavLink to="/practice">Practice</NavLink>
        <NavLink to="/browse">Browse</NavLink>
        <NavLink to="/stats">Progress</NavLink>
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
