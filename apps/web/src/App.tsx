import { useLayoutEffect, useRef } from 'react';
import { EntryScreen } from './components/entry/EntryScreen.tsx';
import { LobbyScreen } from './components/lobby/LobbyScreen.tsx';
import { PlayingScreen } from './components/game/PlayingScreen.tsx';
import { useGamePresentation } from './game-presentation/GamePresentationContext.ts';
import { useGameSession } from './game-session/useGameSession.ts';

function App() {
  const session = useGameSession();
  const { screen, presentationSessionKey } = session;
  const presentation = useGamePresentation();
  const previousPresentationSessionKey = useRef(presentationSessionKey);

  useLayoutEffect(() => {
    if (previousPresentationSessionKey.current !== presentationSessionKey) {
      previousPresentationSessionKey.current = presentationSessionKey;
      presentation.reset();
    }
  }, [presentation, presentationSessionKey]);

  if (screen.status === 'playing') {
    return (
      <PlayingScreen
        view={screen.view}
        viewVersion={screen.viewVersion}
        sync={screen.sync}
        operation={screen.operation}
        actionError={screen.actionError}
        onAction={session.submit}
        onNewGame={() => void session.startSolo()}
        onResetScenario={screen.canResetScenario ? session.resetCurrentScenario : undefined}
      />
    );
  }

  if (screen.status === 'lobby') {
    return (
      <LobbyScreen
        gameId={screen.gameId}
        playerId={screen.playerId}
        view={screen.view}
        pending={screen.start.status === 'pending'}
        error={screen.start.status === 'error' ? screen.start.message : null}
        onStart={session.startCoop}
      />
    );
  }

  return (
    <EntryScreen
      loading={screen.status === 'loading'}
      error={screen.status === 'error' ? screen.message : null}
      onCreateCoop={session.createCoop}
      onJoinCoop={session.joinCoop}
      onStartSolo={session.startSolo}
    />
  );
}

export default App;
