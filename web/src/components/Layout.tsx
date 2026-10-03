import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { getCurrentUser, logout } from '../api/auth'

export default function Layout() {
  const user = getCurrentUser()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <header className="topbar">
        <strong>Balcão</strong>
        <nav>
          <Link to="/tickets">Chamados</Link>
          {user.role === 'customer' && <Link to="/tickets/new">Novo chamado</Link>}
          {user.role === 'admin' && <Link to="/stats">Estatísticas</Link>}
        </nav>
        <span className="who">
          {user.name} ({user.role}) <button onClick={handleLogout}>Sair</button>
        </span>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
