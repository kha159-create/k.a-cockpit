import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { LocaleProvider } from './context/LocaleContext';
import { DirectoryProvider } from '@/context/DirectoryProvider';

// Register Service Worker for PWA (disabled for GitHub Pages)
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/k.a-cockpit/sw.js')
//       .then(registration => {
//         console.log('📱 Service Worker registered successfully:', registration.scope);
//       })
//       .catch(error => {
//         console.log('❌ Service Worker registration failed:', error);
//       });
//   });
// }

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LocaleProvider>
      <DirectoryProvider>
        <App />
      </DirectoryProvider>
    </LocaleProvider>
  </React.StrictMode>
);
