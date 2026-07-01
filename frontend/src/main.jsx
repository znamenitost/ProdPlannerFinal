import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

document.body.style.margin = '0';

// После HMR или пересборки браузер может держать ссылки на старые chunk-*.js — перезагружаем страницу.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)