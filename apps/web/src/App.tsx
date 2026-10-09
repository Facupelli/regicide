import { useRef, useState } from 'react';
import { EntryScreen } from './entry/EntryScreen.tsx';
import { LobbyScreen } from './lobby/LobbyScreen.tsx';
import { PlayingScreen } from './game/PlayingScreen.tsx';
import { useGameSession } from './game-session/useGameSession.ts';
import { AiSettingsScreen } from './profile/AiSettingsScreen.tsx';
import { useProfile } from './profile/useProfile.ts';

type SettingsRoute = 'closed' | 'loading' | 'ready' | { error: string };

function App() {
  const session = useGameSession();
  const profile = useProfile();
  const [settings, setSettings] = useState<SettingsRoute>('closed');
  const settingsRequest = useRef(0);
  const { screen } = session;

  function openSettings() {
    const requestId = ++settingsRequest.current;
    setSettings('loading');
    void profile.ensureProfile().then(
      () => {
        if (requestId === settingsRequest.current) {
          setSettings('ready');
        }
      },
      () => {
        if (requestId === settingsRequest.current) {
          setSettings({ error: 'Could not create your profile. Please try again.' });
        }
      },
    );
  }

  if (settings !== 'closed') {
    return (
      <AiSettingsScreen
        profile={profile.profile?.view ?? null}
        loading={settings === 'loading'}
        loadError={typeof settings === 'object' ? settings.error : null}
        onRetryLoad={openSettings}
        onBack={() => {
          settingsRequest.current += 1;
          setSettings('closed');
        }}
        onSave={profile.save}
        onRevoke={profile.revoke}
      />
    );
  }

  if (screen.status === 'playing') {
    return (
      <PlayingScreen
        view={screen.view}
        viewVersion={screen.viewVersion}
        sync={screen.sync}
        operation={screen.operation}
        actionError={screen.actionError}
        onAction={session.submit}
        onNewGame={screen.view.players.length === 1 ? session.startNewSoloGame : session.returnHome}
        isHost={screen.isHost}
        agentStatus={session.agentStatus}
        agentPause={screen.agentPause}
        agentStatusError={session.agentStatusError}
        onRefreshAgentStatus={session.refreshAiStatus}
        onUpdateAgentSettings={session.saveAiSettings}
        onRetryAgent={session.retryAi}
        onOpenAiSettings={openSettings}
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
        profileBacked={screen.profileBacked}
        profile={profile.profile?.view ?? null}
        pending={screen.start.status === 'pending' || screen.start.status === 'accepted'}
        error={screen.start.status === 'error' ? screen.start.message : null}
        onStart={session.startCoop}
        agentStatus={session.agentStatus}
        agentStatusError={session.agentStatusError}
        onRefreshAgentStatus={session.refreshAiStatus}
        onAddAgent={session.addAiTeammate}
        onRemoveAgent={session.removeAiTeammate}
        onUpdateAgentSettings={session.saveAiSettings}
        onOpenAiSettings={openSettings}
      />
    );
  }

  const view = profile.profile?.view;
  const aiSummary =
    view && view.hasOpenRouterKey && view.enabledModels.length > 0
      ? `OpenRouter configured · ${view.enabledModels.length} model${view.enabledModels.length === 1 ? '' : 's'} enabled`
      : null;

  return (
    <EntryScreen
      loading={screen.status === 'loading'}
      error={screen.status === 'error' ? screen.message : null}
      onCreateCoop={() => void session.createCoop(profile.profile?.token)}
      onJoinCoop={session.joinCoop}
      onStartSolo={session.startSolo}
      onOpenAiSettings={openSettings}
      aiSummary={aiSummary}
      aiConfigured={Boolean(view && (view.hasOpenRouterKey || view.enabledModels.length > 0))}
    />
  );
}

export default App;
