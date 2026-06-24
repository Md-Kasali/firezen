import { useState, useEffect } from 'react'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'


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
