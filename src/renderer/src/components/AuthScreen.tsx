import React, { useEffect, useState } from 'react'
import { UploadCloud, Database, Target } from 'lucide-react'

interface AuthScreenProps {
  onLogin: () => void
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [projects, setProjects] = useState<string[]>([])

  useEffect(() => {
    window.api.getSavedProjects().then(setProjects).catch(console.error)
  }, [])

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const jsonText = event.target?.result as string
        const res = await window.api.connect({ json: jsonText })
        if (res.success) {
           onLogin()
        } else {
           alert("Failed to connect: " + res.error)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleSelectProject = async (projectId: string) => {
     const res = await window.api.connect({ projectId })
     if (res.success) onLogin()
     else alert("Connection failed: " + res.error)
  }

  const onDragOver = (e: React.DragEvent) => e.preventDefault()

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        <Database size={64} className="auth-logo" />
        <h1 className="auth-title">Firezen Manager</h1>
        <p className="auth-subtitle">Securely connect to your Firebase Project</p>
        
        {projects.length > 0 && (
           <div style={{ width: '100%', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <span style={{ fontSize: '13px', color: 'var(--text-color-mute)' }}>Saved Projects</span>
             {projects.map(pid => (
                <button 
                  key={pid} 
                  onClick={() => handleSelectProject(pid)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--bg-color-soft)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                >
                   <Target size={18} style={{ color: 'var(--accent-color)' }} />
                   {pid}
                </button>
             ))}
             <div style={{ height: '8px' }} />
           </div>
        )}

        <div className="drop-zone" onDrop={onDrop} onDragOver={onDragOver}>
          <UploadCloud size={48} className="drop-zone-icon" />
          <p>Drop your <strong>serviceAccountKey.json</strong> here {projects.length > 0 ? "to add another project" : ""}</p>
          <span style={{ fontSize: '12px', color: 'var(--text-color-mute)' }}>
            Credentials will be AES-256 encrypted and stored locally.
          </span>
        </div>
      </div>
    </div>
  )
}
