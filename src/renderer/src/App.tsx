import { useState, useEffect } from 'react'
import { ThemeProvider, useTheme } from './components/ThemeProvider'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { Moon, Sun } from 'lucide-react'

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()
  return (
    <button 
      className="title-bar-button" 
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title="Toggle Theme"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    window.api.connect().then(res => {
      if (res.success) setIsAuthenticated(true)
      setIsInitializing(false)
    }).catch(() => setIsInitializing(false))
  }, [])

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="title-bar">
         <div style={{ flex: 1, fontWeight: 600, fontSize: 13, color: 'var(--text-color-mute)' }}>
            Firezen
         </div>
         <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as any}>
            <ThemeToggle />
         </div>
      </div>
      {!isAuthenticated ? (
         <AuthScreen onLogin={() => setIsAuthenticated(true)} />
      ) : (
         <Dashboard onAddProject={() => setIsAuthenticated(false)} />
      )}
    </ThemeProvider>
  )
}

export default App
