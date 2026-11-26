import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/ibm-plex-sans-arabic/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/latin-700.css';
import './index.css';
import App from './App';
import { readUiCache } from './lib/settings';

// Apply the saved language and theme before the first paint (the database loads a moment later).
const ui = readUiCache();
const root = document.documentElement;
if (ui.language === 'ar') {
  root.lang = 'ar';
  root.dir = 'rtl';
}
if (ui.theme === 'dark' || (ui.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  root.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
