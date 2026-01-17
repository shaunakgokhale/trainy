import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'

import APITestPage from './pages/APITestPage'
import MyJourneysPage from './pages/MyJourneysPage'
import SearchPage from './pages/SearchPage'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
            <div className="text-xl font-semibold">Trainy</div>
            <nav className="flex gap-4 text-sm font-medium">
              <Link className="text-slate-700 hover:text-slate-900" to="/">
                Search
              </Link>
              <Link
                className="text-slate-700 hover:text-slate-900"
                to="/journeys"
              >
                My Journeys
              </Link>
              <Link
                className="text-slate-700 hover:text-slate-900"
                to="/test"
              >
                API Test
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/journeys" element={<MyJourneysPage />} />
            <Route path="/test" element={<APITestPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
