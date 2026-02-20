import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import App from './App.jsx';

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary 
    name="Beads UI" 
    onReset={() => window.location.reload()}
  >
    <App />
  </ErrorBoundary>
);
