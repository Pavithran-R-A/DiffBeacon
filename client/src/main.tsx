/**
 * DiffBeacon web entry design reminder: local-first, semantic, and quiet. The
 * browser demo must not add telemetry or move pasted source-code off the page.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
