# Creating a game creates a lobby with its host as the first player.
POST {{base_url}}/games
HTTP 201
[Captures]
gameId: jsonpath "$.gameId"
hostPlayerId: jsonpath "$.playerId"
[Asserts]
header "Location" exists
jsonpath "$.gameId" matches /^.+$/
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.hostPlayerId" == "{{hostPlayerId}}"
jsonpath "$.view.players" count == 1
jsonpath "$.view.players[0].id" == "{{hostPlayerId}}"

GET {{base_url}}/games/{{gameId}}
HTTP 200
[Asserts]
jsonpath "$.gameId" == "{{gameId}}"
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.players" count == 1

# Commands are rejected until the lobby has started.
POST {{base_url}}/games/{{gameId}}/actions
X-Player-Id: {{hostPlayerId}}
Content-Type: application/json
{"kind":"yield"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "game-not-started"

POST {{base_url}}/games/{{gameId}}/join
HTTP 201
[Captures]
secondPlayerId: jsonpath "$.playerId"
[Asserts]
jsonpath "$.gameId" == "{{gameId}}"
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.players" count == 2
jsonpath "$.view.players[1].id" == "{{secondPlayerId}}"

POST {{base_url}}/games/{{gameId}}/join
HTTP 201
[Asserts]
jsonpath "$.view.players" count == 3

POST {{base_url}}/games/{{gameId}}/join
HTTP 201
[Asserts]
jsonpath "$.view.players" count == 4

POST {{base_url}}/games/{{gameId}}/join
HTTP 409
[Asserts]
jsonpath "$.error.code" == "lobby-full"

POST {{base_url}}/games/{{gameId}}/start
X-Player-Id: {{secondPlayerId}}
HTTP 403
[Asserts]
jsonpath "$.error.code" == "not-host"

POST {{base_url}}/games/{{gameId}}/start
X-Player-Id: {{hostPlayerId}}
HTTP 200
[Asserts]
jsonpath "$.gameId" == "{{gameId}}"
jsonpath "$.view.status" == "active"
jsonpath "$.view.players" count == 4
jsonpath "$.view.viewer.id" == "{{hostPlayerId}}"
jsonpath "$.view.viewer.hand" count == 5

GET {{base_url}}/games/{{gameId}}
X-Player-Id: {{secondPlayerId}}
HTTP 200
[Asserts]
jsonpath "$.view.status" == "active"
jsonpath "$.view.viewer.id" == "{{secondPlayerId}}"
jsonpath "$.view.viewer.hand" count == 5
jsonpath "$.view.interaction.kind" == "waiting"

GET {{base_url}}/games/{{gameId}}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games/{{gameId}}/actions
X-Player-Id: not-a-player-in-this-game
Content-Type: application/json
{"kind":"yield"}
HTTP 403
[Asserts]
jsonpath "$.error.code" == "player-not-in-game"

POST {{base_url}}/games/{{gameId}}/join
HTTP 409
[Asserts]
jsonpath "$.error.code" == "game-already-started"

POST {{base_url}}/games/{{gameId}}/start
X-Player-Id: {{hostPlayerId}}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "game-already-started"

POST {{base_url}}/games/this-game-does-not-exist/join
HTTP 404
[Asserts]
jsonpath "$.error.code" == "game-not-found"

GET {{base_url}}/games/this-game-does-not-exist
HTTP 404
[Asserts]
jsonpath "$.error.code" == "game-not-found"

GET {{base_url}}/not-a-route
HTTP 404
[Asserts]
jsonpath "$.error.code" == "route-not-found"

# Start a separate solo lobby to exercise the original command validation checks.
POST {{base_url}}/games
HTTP 201
[Captures]
soloGameId: jsonpath "$.gameId"
soloPlayerId: jsonpath "$.playerId"
[Asserts]
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.players" count == 1

POST {{base_url}}/games/{{soloGameId}}/start
X-Player-Id: {{soloPlayerId}}
HTTP 200
[Asserts]
jsonpath "$.view.status" == "active"
jsonpath "$.view.viewer.hand" count == 8
jsonpath "$.view.soloJestersRemaining" == 2

POST {{base_url}}/games/{{soloGameId}}/actions
X-Player-Id: {{soloPlayerId}}
Content-Type: text/plain
```
not JSON
```
HTTP 415
[Asserts]
jsonpath "$.error.code" == "unsupported-media-type"

POST {{base_url}}/games/{{soloGameId}}/actions
X-Player-Id: {{soloPlayerId}}
Content-Type: application/json
```
{"kind":
```
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games/{{soloGameId}}/actions
X-Player-Id: {{soloPlayerId}}
Content-Type: application/json
{"kind":"not-a-command"}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

# This is valid protocol data, but the initial solo state cannot accept defeat.
POST {{base_url}}/games/{{soloGameId}}/actions
X-Player-Id: {{soloPlayerId}}
Content-Type: application/json
{"kind":"accept-defeat"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "invalid-action"

POST {{base_url}}/games/{{soloGameId}}/actions
X-Player-Id: {{soloPlayerId}}
Content-Type: application/json
{"kind":"use-solo-jester"}
HTTP 200
[Asserts]
jsonpath "$.view.status" == "active"
jsonpath "$.view.soloJestersRemaining" == 1
