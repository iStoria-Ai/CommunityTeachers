import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChildrenLibraryScreen } from './screens/ChildrenLibraryScreen';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChildrenLibraryScreen />
    <PWAInstallPrompt />
  </React.StrictMode>
);
