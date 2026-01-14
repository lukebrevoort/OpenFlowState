import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Integrations from './pages/Integrations';
import Preferences from './pages/Preferences';
import Agents from './pages/Agents';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Integrations />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="preferences" element={<Preferences />} />
        <Route path="agents" element={<Agents />} />
        <Route path="callback/:provider" element={<OAuthCallback />} />
      </Route>
    </Routes>
  );
}

// OAuth callback handler
function OAuthCallback() {
  // TODO: Handle OAuth callbacks
  return (
    <div className="oauth-callback">
      <h2>Connecting...</h2>
      <p>Processing authentication...</p>
    </div>
  );
}

export default App;
