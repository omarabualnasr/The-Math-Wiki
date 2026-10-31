import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app/App';
import ErrorBoundary from './app/ErrorBoundary';
import './styles/global.css';
import { runStorageMigrations } from './engine/storageMigrations';
import { registerAppServiceWorker } from './engine/pwa';

// Copy legacy preferences and playground data to the namespaced storage keys.
// The migration is non-destructive and safe to retry after a partial failure.
runStorageMigrations();
void registerAppServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
