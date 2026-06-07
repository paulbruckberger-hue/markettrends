import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { queryClient } from './lib/queryClient';
import { applyTheme, Theme } from './lib/theme';
import './index.css';

applyTheme(
  (localStorage.getItem('nl_theme') as Theme) || 'dim',
  localStorage.getItem('nl_accent') || '#1d9bf0',
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
