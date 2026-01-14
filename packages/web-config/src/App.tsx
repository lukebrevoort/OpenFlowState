import { Routes, Route, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Integrations from './pages/Integrations';
import Preferences from './pages/Preferences';
import Agents from './pages/Agents';
import { exchangeGoogleCode } from './api';

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
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      if (!code) {
        setStatus('Error: No code received');
        return;
      }

      if (provider === 'google') {
        const stored = localStorage.getItem('flowstate_oauth_pending');
        if (!stored) {
          setStatus('Error: No pending authentication found');
          return;
        }

        try {
          const { clientId, clientSecret, redirectUri } = JSON.parse(stored);
          await exchangeGoogleCode({ code, clientId, clientSecret, redirectUri });
          
          localStorage.removeItem('flowstate_oauth_pending');
          setStatus('Success! Redirecting...');
          setTimeout(() => navigate('/integrations'), 1500);
        } catch (error: any) {
          setStatus(`Error: ${error.message}`);
        }
      }
    }
    
    handleCallback();
  }, [provider, searchParams, navigate]);

  return (
    <div className="oauth-callback" style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>{provider === 'google' ? 'Google Authentication' : 'Authentication'}</h2>
      <p>{status}</p>
    </div>
  );
}

export default App;
