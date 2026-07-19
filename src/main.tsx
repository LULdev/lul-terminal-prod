import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { PageVisibilityProvider } from './context/PageVisibilityContext';
import { AuthModal } from './components/auth/AuthModal';
import { FeatureLoginGate } from './components/auth/FeatureLoginGate';
import { parseImageViewerId } from './lib/imageHosting';
import { ImageHostViewer } from './components/image/ImageHostViewer';

const imageViewerId = parseImageViewerId();

createRoot(document.getElementById('root')!).render(
  imageViewerId ? (
    <StrictMode>
      <AuthProvider>
        <ImageHostViewer id={imageViewerId} />
        <FeatureLoginGate />
        <AuthModal />
      </AuthProvider>
    </StrictMode>
  ) : (
    <StrictMode>
      <AuthProvider>
        <PageVisibilityProvider>
          <App />
        </PageVisibilityProvider>
      </AuthProvider>
    </StrictMode>
  ),
);
