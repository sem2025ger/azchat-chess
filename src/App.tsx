import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <Router basename="/azchat-chess/">
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <header className="border-b border-slate-700 p-4">
          <h1 className="text-3xl font-bold">Azchat Chess</h1>
        </header>
        <main className="p-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Welcome to Azchat Chess</h2>
      <p className="text-slate-300 mb-6">
        Interactive chess application with real-time collaboration.
      </p>
      <div className="bg-slate-700 rounded-lg p-6">
        <p className="text-slate-400">Application is loading...</p>
      </div>
    </div>
  )
}

export default App
