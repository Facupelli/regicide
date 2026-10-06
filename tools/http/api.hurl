# Create a solo game and reuse its ID for the remaining action checks.
POST {{base_url}}/games
HTTP 201
[Captures]
gameId: jsonpath "$.gameId"
[Asserts]
header "Location" exists
jsonpath "$.gameId" matches /^.+$/
jsonpath "$.view.status" == "active"
jsonpath "$.view.viewer.hand" count == 8

GET {{base_url}}/games/{{gameId}}
HTTP 200
[Asserts]
jsonpath "$.gameId" == "{{gameId}}"
jsonpath "$.view.status" == "active"

GET {{base_url}}/games/this-game-does-not-exist
HTTP 404
[Asserts]
jsonpath "$.error.code" == "game-not-found"

GET {{base_url}}/not-a-route
HTTP 404
[Asserts]
jsonpath "$.error.code" == "route-not-found"

POST {{base_url}}/games/{{gameId}}/actions
Content-Type: text/plain
```
not JSON
```
HTTP 415
[Asserts]
jsonpath "$.error.code" == "unsupported-media-type"

POST {{base_url}}/games/{{gameId}}/actions
Content-Type: application/json
```
{"kind":
```
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

POST {{base_url}}/games/{{gameId}}/actions
Content-Type: application/json
{"kind":"not-a-command"}
HTTP 400
[Asserts]
jsonpath "$.error.code" == "invalid-request"

# This is valid protocol data, but the initial solo state cannot accept defeat.
POST {{base_url}}/games/{{gameId}}/actions
Content-Type: application/json
{"kind":"accept-defeat"}
HTTP 409
[Asserts]
jsonpath "$.error.code" == "invalid-action"
