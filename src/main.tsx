import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import { App } from './App';
import { bootstrapLiFi } from './lib/lifiBootstrap';
import './index.css';

bootstrapLiFi();

/** Side panel (and other wide hosts): center content and allow more horizontal space. */
const WIDE_SURFACE_MIN_INNER_WIDTH = 440;
function syncL33tSurfaceLayoutClass(): void {
  const wide = window.innerWidth >= WIDE_SURFACE_MIN_INNER_WIDTH;
  document.documentElement.classList.toggle('l33t-wide-surface', wide);
}
syncL33tSurfaceLayoutClass();
window.addEventListener('resize', syncL33tSurfaceLayoutClass);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
