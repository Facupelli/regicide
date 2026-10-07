import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { MotionConfig } from 'motion/react';
import { GamePresentationProvider } from './game-presentation/GamePresentationProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <GamePresentationProvider>
        <App />
      </GamePresentationProvider>
    </MotionConfig>
  </StrictMode>,
);
