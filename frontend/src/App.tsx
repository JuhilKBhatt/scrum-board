import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [apiStatus, setApiStatus] = useState<string>('Checking...')

  useEffect(() => {
    // Vite sets VITE_API_URL via our docker-compose environment variables
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    
    fetch(`${apiUrl}/health`)
      .then(res => res.json())
      .then(data => setApiStatus(`Backend Status: ${data.status}`))
      .catch(err => {
        console.error(err)
        setApiStatus('Backend Status: Failed to connect')
      })
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Scrum Board App</h1>
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: apiStatus.includes('ok') ? '#e6fffa' : '#fff5f5',
        color: apiStatus.includes('ok') ? '#2c7a7b' : '#c53030',
        borderRadius: '8px',
        display: 'inline-block'
      }}>
        {apiStatus}
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <p>Your full-stack application is ready to be built!</p>
        <ul>
          <li><strong>Frontend:</strong> React + Vite</li>
          <li><strong>Backend:</strong> Python + FastAPI</li>
          <li><strong>Database:</strong> PostgreSQL</li>
          <li><strong>Infrastructure:</strong> Docker + docker-compose</li>
        </ul>
      </div>
    </div>
  )
}

export default App
