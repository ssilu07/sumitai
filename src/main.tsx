import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { MiniApp } from './MiniApp';
import './index.css';

// When Electron creates the dedicated mini window it loads the app with ?mode=mini.
// We render only the lightweight MiniWidget in that case to avoid spinning up
// audio capture, WebSocket connections, and other heavy resources.
const isMiniWindow = new URLSearchParams(window.location.search).get('mode') === 'mini';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isMiniWindow ? <MiniApp /> : <App />}
  </React.StrictMode>,
);
