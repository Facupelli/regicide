import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { EntryScreen } from './entry/EntryScreen.tsx';
import { InvitationScreen } from './entry/InvitationScreen.tsx';
import { LobbyScreen } from './lobby/LobbyScreen.tsx';
import { PlayingScreen } from './game/PlayingScreen.tsx';
import { useGameSession } from './game-session/useGameSession.ts';
import { AiSettingsScreen } from './profile/AiSettingsScreen.tsx';
import { useProfile } from './profile/useProfile.ts';

type SettingsRoute = 'closed' | 'loading' | 'ready' | { error: string };
type Invitation = { status: 'valid'; gameId: string } | { status: 'invalid' };

// Games are created with randomUUID. Reject malformed links before sending a join request.
const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readInvitation(): Invitation | null {
  const ids = new URL(window.location.href).searchParams.getAll('join');
  const id = ids[0];
  if (id === undefined) {
    return null;
  }
  return ids.length === 1 && gameIdPattern.test(id)
    ? { status: 'valid', gameId: id }
    : { status: 'invalid' };
}

function App() {
  const session = useGameSession();
  const profile = useProfile();
  const [settings, setSettings] = useState<SettingsRoute>('closed');
  const settingsRequest = useRef(0);
  const [invitation, setInvitation] = useState<Invitation | null>(readInvitation);
  const invitedGame = useRef<string | null>(null);
  const [invitationJoining, setInvitationJoining] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const { screen } = session;
  const currentGameId =
    screen.status === 'lobby' || screen.status === 'playing' ? screen.gameId : null;

  const joinInvitation = useEffectEvent(async (gameId: string) => {
    if (await session.joinCoop(gameId)) {
      leaveInvitation();
    }
  });

  useEffect(() => {
    if (invitation?.status !== 'valid') {
      return;
    }
    if (currentGameId === invitation.gameId) {
      leaveInvitation();
      return;
    }
    if (screen.status !== 'idle' || invitedGame.current === invitation.gameId) {
      return;
    }
    invitedGame.current = invitation.gameId;
    void joinInvitation(invitation.gameId);
  }, [invitation, currentGameId, screen.status]);

  async function joinDifferentGame(gameId: string) {
    if (invitationJoining) {
      return;
    }
    setInvitationJoining(true);
    setInvitationError(null);
    const joined = await session.joinCoop(gameId);
    setInvitationJoining(false);
    if (joined) {
      leaveInvitation();
    } else {
      setInvitationError('Could not join the invited game. Your current game is still available.');
    }
  }

  function leaveInvitation() {
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    window.history.replaceState(window.history.state, '', url);
    setInvitation(null);
  }

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
          setSettings({ error: 'Could not open AI Settings. Please try again.' });
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

  if (screen.status === 'restoring' || screen.status === 'restore-error') {
    return (
      <InvitationScreen
        message="Restoring game..."
        error={screen.status === 'restore-error' ? screen.message : null}
        onRetry={screen.status === 'restore-error' ? session.retryRestore : undefined}
        onBack={() => {
          session.abandonRestore();
          if (invitation) {
            leaveInvitation();
          }
        }}
      />
    );
  }

  if (invitation?.status === 'invalid' && currentGameId) {
    return <InvitationScreen error="Invalid invitation link." onBack={leaveInvitation} />;
  }

  if (invitation?.status === 'valid' && currentGameId && currentGameId !== invitation.gameId) {
    return (
      <InvitationScreen
        error={invitationError}
        message={invitationJoining ? 'Joining game...' : undefined}
        onJoin={invitationJoining ? undefined : () => void joinDifferentGame(invitation.gameId)}
        onResume={leaveInvitation}
        onBack={leaveInvitation}
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
        onNewGame={screen.view.players.length === 1 ? session.startSolo : session.returnHome}
        isHost={screen.isHost}
        agentStatus={session.agentStatus}
        agentPause={screen.agentPause}
        agentStatusError={session.agentStatusError}
        onRefreshAgentStatus={session.refreshAiStatus}
        onUpdateAgentSettings={session.saveAiSettings}
        onRetryAgent={session.retryAi}
        onOpenAiSettings={profile.profile ? openSettings : undefined}
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

  if (invitation) {
    let error: string | null = null;
    if (invitation.status === 'invalid') {
      error = 'Invalid invitation link.';
    } else if (screen.status === 'error') {
      error = screen.message;
    }
    return (
      <InvitationScreen
        error={error}
        onBack={() => {
          session.clearEntryError();
          leaveInvitation();
        }}
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
      onStartSolo={session.startSolo}
      onOpenAiSettings={openSettings}
      aiSummary={aiSummary}
      aiConfigured={Boolean(view && (view.hasOpenRouterKey || view.enabledModels.length > 0))}
    />
  );
}

export default App;
