# Creating a game requires a valid JSON nickname.
POST {{base_url}}/games
HTTP 415
[Asserts]
jsonpath "$.error.code" == "unsupported-media-type"

POST {{base_url}}/games
Content-Type: application/json
{}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games
Content-Type: application/json
{"name":"   "}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games
Content-Type: application/json
{"name":"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg"}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

# Creating a game creates a lobby with its host as the first player.
POST {{base_url}}/games
Content-Type: application/json
{"name":"Host"}
HTTP 201
[Captures]
gameId: jsonpath "$.gameId"
hostPlayerId: jsonpath "$.playerId"
hostPlayerToken: jsonpath "$.playerToken"
[Asserts]
header "Location" exists
jsonpath "$.gameId" matches /^.+$/
jsonpath "$.playerToken" matches /^[A-Za-z0-9_-]{43}$/
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.hostPlayerId" == "{{hostPlayerId}}"
jsonpath "$.view.players" count == 1
jsonpath "$.view.players[0].id" == "{{hostPlayerId}}"
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.players[0].controller" == "human"
jsonpath "$.view.players[0].playerToken" not exists

GET {{base_url}}/games/{{gameId}}
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

GET {{base_url}}/games/{{gameId}}
Authorization: Bearer {{hostPlayerToken}}
HTTP 200
[Asserts]
jsonpath "$.gameId" == "{{gameId}}"
jsonpath "$.playerId" == "{{hostPlayerId}}"
jsonpath "$.isHost" == true
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.players" count == 1
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.playerToken" not exists

# Commands are rejected until the lobby has started.
POST {{base_url}}/games/{{gameId}}/actions
Authorization: Bearer {{hostPlayerToken}}
Content-Type: application/json
{"kind":"yield"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "game-not-started"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":"  Alice  "}
HTTP 201
[Captures]
secondPlayerId: jsonpath "$.playerId"
secondPlayerToken: jsonpath "$.playerToken"
[Asserts]
jsonpath "$.gameId" == "{{gameId}}"
jsonpath "$.playerToken" matches /^[A-Za-z0-9_-]{43}$/
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.players" count == 2
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.players[1].id" == "{{secondPlayerId}}"
jsonpath "$.view.players[1].name" == "Alice"
jsonpath "$.view.players[1].controller" == "human"
jsonpath "$.view.players[1].playerToken" not exists

GET {{base_url}}/games/{{gameId}}
Authorization: Bearer {{secondPlayerToken}}
HTTP 200
[Asserts]
jsonpath "$.playerId" == "{{secondPlayerId}}"
jsonpath "$.isHost" == false
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.players" count == 2
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.players[1].name" == "Alice"

# Rejected joins must not take a slot or replace an existing player's name.
POST {{base_url}}/games/{{gameId}}/join
HTTP 415
[Asserts]
jsonpath "$.error.code" == "unsupported-media-type"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":""}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":"Bad\u0007Name"}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":" aLiCe "}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "name-taken"

GET {{base_url}}/games/{{gameId}}
Authorization: Bearer {{hostPlayerToken}}
HTTP 200
[Asserts]
jsonpath "$.view.players" count == 2
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.players[1].name" == "Alice"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":"Carol"}
HTTP 201
[Asserts]
jsonpath "$.view.players" count == 3
jsonpath "$.view.players[1].name" == "Alice"
jsonpath "$.view.players[2].name" == "Carol"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":"Dave"}
HTTP 201
[Asserts]
jsonpath "$.view.players" count == 4
jsonpath "$.view.players[3].name" == "Dave"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":"Eve"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "lobby-full"

POST {{base_url}}/games/{{gameId}}/start
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

POST {{base_url}}/games/{{gameId}}/start
Authorization: Bearer {{hostPlayerId}}
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

POST {{base_url}}/games/{{gameId}}/start
Authorization: Basic {{hostPlayerToken}}
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

POST {{base_url}}/games/{{gameId}}/start
Authorization: Bearer {{secondPlayerToken}}
HTTP 403
[Asserts]
jsonpath "$.error.code" == "not-host"

POST {{base_url}}/games/{{gameId}}/start
Authorization: Bearer {{hostPlayerToken}}
HTTP 200
[Asserts]
jsonpath "$.gameId" == "{{gameId}}"
jsonpath "$.view.status" == "active"
jsonpath "$.view.players" count == 4
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.players[1].name" == "Alice"
jsonpath "$.view.players[2].name" == "Carol"
jsonpath "$.view.players[3].name" == "Dave"
jsonpath "$.view.viewer.id" == "{{hostPlayerId}}"
jsonpath "$.view.viewer.hand" count == 5
jsonpath "$.view.playerToken" not exists

GET {{base_url}}/games/{{gameId}}
Authorization: Bearer {{secondPlayerToken}}
HTTP 200
[Asserts]
jsonpath "$.playerId" == "{{secondPlayerId}}"
jsonpath "$.isHost" == false
jsonpath "$.view.status" == "active"
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.players[1].name" == "Alice"
jsonpath "$.view.viewer.id" == "{{secondPlayerId}}"
jsonpath "$.view.viewer.hand" count == 5
jsonpath "$.view.interaction.kind" == "waiting"
jsonpath "$.playerToken" not exists

GET {{base_url}}/games/{{gameId}}
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

GET {{base_url}}/games/{{gameId}}
Authorization: Bearer not-a-player-in-this-game
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

POST {{base_url}}/games/{{gameId}}/actions
Content-Type: application/json
{"kind":"yield"}
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

POST {{base_url}}/games/{{gameId}}/actions
Authorization: Bearer not-a-player-in-this-game
Content-Type: application/json
{"kind":"yield"}
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

POST {{base_url}}/games/{{gameId}}/join
Content-Type: application/json
{"name":"Latecomer"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "game-already-started"

POST {{base_url}}/games/{{gameId}}/start
Authorization: Bearer {{hostPlayerToken}}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "game-already-started"

POST {{base_url}}/games/this-game-does-not-exist/join
Content-Type: application/json
{"name":"Visitor"}
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
Content-Type: application/json
{"name":"Host"}
HTTP 201
[Captures]
soloGameId: jsonpath "$.gameId"
soloPlayerId: jsonpath "$.playerId"
soloPlayerToken: jsonpath "$.playerToken"
[Asserts]
jsonpath "$.view.status" == "lobby"
jsonpath "$.view.players" count == 1
jsonpath "$.view.players[0].name" == "Host"

POST {{base_url}}/games/{{soloGameId}}/start
Authorization: Bearer {{hostPlayerToken}}
HTTP 401
[Asserts]
jsonpath "$.error.code" == "invalid-credential"

POST {{base_url}}/games/{{soloGameId}}/start
Authorization: Bearer {{soloPlayerToken}}
HTTP 200
[Asserts]
jsonpath "$.view.status" == "active"
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.viewer.id" == "{{soloPlayerId}}"
jsonpath "$.view.viewer.hand" count == 8
jsonpath "$.view.soloJestersRemaining" == 2

POST {{base_url}}/games/{{soloGameId}}/actions
Authorization: Bearer {{soloPlayerToken}}
Content-Type: text/plain
```
not JSON
```
HTTP 415
[Asserts]
jsonpath "$.error.code" == "unsupported-media-type"

POST {{base_url}}/games/{{soloGameId}}/actions
Authorization: Bearer {{soloPlayerToken}}
Content-Type: application/json
```
{"kind":
```
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games/{{soloGameId}}/actions
Authorization: Bearer {{soloPlayerToken}}
Content-Type: application/json
{"kind":"not-a-command"}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

# This is valid protocol data, but the initial solo state cannot accept defeat.
POST {{base_url}}/games/{{soloGameId}}/actions
Authorization: Bearer {{soloPlayerToken}}
Content-Type: application/json
{"kind":"accept-defeat"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "invalid-action"

POST {{base_url}}/games/{{soloGameId}}/actions
Authorization: Bearer {{soloPlayerToken}}
Content-Type: application/json
{"kind":"use-solo-jester"}
HTTP 200
[Asserts]
jsonpath "$.view.status" == "active"
jsonpath "$.view.players[0].name" == "Host"
jsonpath "$.view.soloJestersRemaining" == 1
jsonpath "$.playerToken" not exists

# Agent names are assigned on addition, avoid collisions, and retain their model IDs.
# Keep this game in the lobby so no model-provider request is made.
POST {{base_url}}/profiles
HTTP 201
[Captures]
agentProfileToken: jsonpath "$.profileToken"

PUT {{base_url}}/profiles/me/ai
Authorization: Bearer {{agentProfileToken}}
Content-Type: application/json
{"enabledModels":["deepseek/deepseek-v4.1-flash"]}
HTTP 204

POST {{base_url}}/games
Authorization: Bearer {{agentProfileToken}}
Content-Type: application/json
{"name":"Agent Host"}
HTTP 201
[Captures]
agentGameId: jsonpath "$.gameId"
agentHostToken: jsonpath "$.playerToken"
[Asserts]
jsonpath "$.view.players[0].name" == "Agent Host"

POST {{base_url}}/games/{{agentGameId}}/agents
Authorization: Bearer {{agentHostToken}}
Content-Type: application/json
{"model":"deepseek/deepseek-v4.1-flash"}
HTTP 201
[Captures]
firstAgentId: jsonpath "$.view.players[1].id"
[Asserts]
jsonpath "$.view.players[1].name" == "AI Player DeepSeek"
jsonpath "$.view.players[1].controller" == "agent"
jsonpath "$.view.players[1].model" == "deepseek/deepseek-v4.1-flash"

POST {{base_url}}/games/{{agentGameId}}/agents
Authorization: Bearer {{agentHostToken}}
Content-Type: application/json
{"model":"deepseek/deepseek-v4.1-flash"}
HTTP 201
[Captures]
secondAgentId: jsonpath "$.view.players[2].id"
[Asserts]
jsonpath "$.view.players[1].id" == "{{firstAgentId}}"
jsonpath "$.view.players[1].name" == "AI Player DeepSeek"
jsonpath "$.view.players[2].name" == "AI Player DeepSeek (2)"
jsonpath "$.view.players[2].model" == "deepseek/deepseek-v4.1-flash"

POST {{base_url}}/games/{{agentGameId}}/join
Content-Type: application/json
{"name":"ai player deepseek"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "name-taken"

GET {{base_url}}/games/{{agentGameId}}
Authorization: Bearer {{agentHostToken}}
HTTP 200
[Asserts]
jsonpath "$.view.players" count == 3
jsonpath "$.view.players[1].id" == "{{firstAgentId}}"
jsonpath "$.view.players[1].name" == "AI Player DeepSeek"
jsonpath "$.view.players[2].id" == "{{secondAgentId}}"
jsonpath "$.view.players[2].name" == "AI Player DeepSeek (2)"

# An existing human name also forces an agent suffix in a separate session.
POST {{base_url}}/games
Authorization: Bearer {{agentProfileToken}}
Content-Type: application/json
{"name":"AI Player DeepSeek"}
HTTP 201
[Captures]
collisionGameId: jsonpath "$.gameId"
collisionHostToken: jsonpath "$.playerToken"

POST {{base_url}}/games/{{collisionGameId}}/agents
Authorization: Bearer {{collisionHostToken}}
Content-Type: application/json
{"model":"deepseek/deepseek-v4.1-flash"}
HTTP 201
[Asserts]
jsonpath "$.view.players[0].name" == "AI Player DeepSeek"
jsonpath "$.view.players[0].controller" == "human"
jsonpath "$.view.players[1].name" == "AI Player DeepSeek (2)"
jsonpath "$.view.players[1].controller" == "agent"
