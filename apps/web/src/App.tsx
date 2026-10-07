import { EntryScreen } from './entry/EntryScreen.tsx';
import { LobbyScreen } from './lobby/LobbyScreen.tsx';
import { PlayingScreen } from './game/PlayingScreen.tsx';
import { useGameSession } from './game-session/useGameSession.ts';

function App() {
  const session = useGameSession();
  const { screen } = session;

  if (screen.status === 'playing') {
    return (
      <PlayingScreen
        view={screen.view}
        viewVersion={screen.viewVersion}
        sync={screen.sync}
        operation={screen.operation}
        actionError={screen.actionError}
        onAction={session.submit}
        onNewGame={session.startNewSoloGame}
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
        pending={screen.start.status === 'pending' || screen.start.status === 'accepted'}
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
