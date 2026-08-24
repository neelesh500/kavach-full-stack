import useHashRoute from './useHashRoute.js';
import CustodianFlow from './pages/CustodianFlow.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

export default function App() {
  const route = useHashRoute();

  return (
    <div className="app">
      <nav className="topnav">
        <span className="brand">ThresholdAuth <small>Shamir (5,3) Secret Sharing</small></span>
        <div className="navlinks">
          <a href="#/custodian" className={route === '/custodian' ? 'active' : ''}>Custodian Login</a>
          <a href="#/admin" className={route === '/admin' ? 'active' : ''}>Admin Dashboard</a>
        </div>
      </nav>
      {route === '/admin' ? <AdminDashboard /> : <CustodianFlow />}
    </div>
  );
}
