# Safe Route Backend (Express + MongoDB)

This backend provides authentication APIs used by the mobile app:

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

Safety APIs:

- GET /api/safety/hazards
- POST /api/safety/hazards
- GET /api/safety/feed
- POST /api/safety/feed
- GET /api/safety/incidents
- POST /api/safety/route-score

Contacts APIs (auth required):

- GET /api/contacts
- POST /api/contacts/sync

SOS APIs (auth required):

- POST /api/sos/trigger
- POST /api/sos/update-location
- GET /api/sos/active

## 1. Setup

1. Install dependencies:

npm install

2. Copy environment file:

cp .env.example .env

3. Update `.env` values.

4. Start server:

npm run dev

The default server URL is http://localhost:3001.

Route safety scoring requires OpenWeatherMap key:

- `WEATHER_API_KEY=your_openweathermap_api_key`

Optional live traffic flow for Fusion widgets (TomTom):

- `TOMTOM_API_KEY=your_tomtom_api_key`
- `TOMTOM_FLOW_CENTER_LAT=17.3850`
- `TOMTOM_FLOW_CENTER_LNG=78.4867`

TomTom live incidents ingestion:

- `GET /api/safety/incidents?lat=17.3850&lng=78.4867&radius_km=3`
- Route scoring also ingests nearby TomTom incidents and includes them in hazard risk computation.

## 2. Rule-Based Route Safety Scoring

Endpoint:

- `POST /api/safety/route-score`

Request body (supports one route as `route` or many routes as `routes`):

```json
{
	"routes": [
		{
			"route_id": "route-0",
			"distanceMeters": 4200,
			"durationSeconds": 920,
			"transport_mode": "car",
			"coordinates": [
				{ "latitude": 12.97, "longitude": 77.59 },
				{ "latitude": 12.98, "longitude": 77.61 }
			]
		}
	],
	"transport_mode": "car",
	"segment_length_m": 100,
	"weather_api_key": "optional_if_set_in_env"
}
```

Transport modes supported for scoring calibration:

- `heavy` (truck / bus / lorry)
- `car`
- `bike`
- `cycle`
- `walk`

`transport_mode` can be sent either globally at request root or per route, and per-route value takes priority.

Response:

```json
{
	"scorer": "rule-based",
	"schema_version": "2026-03-transport-mode-v1",
	"updated_at": "2026-03-24T12:34:56.000Z",
	"routes": [
		{
			"route_id": "route-0",
			"safety_score": 78,
			"safety_label": "Moderate",
			"transport_mode": "car",
			"ml_features": {
				"transport_mode": "car",
				"avg_speed_mps": 4.57,
				"is_night": false
			},
			"factors": {
				"crime": 0.54,
				"weather": 0.3,
				"traffic": 0.49,
				"hazard": 0.15,
				"lighting": 0.2,
				"time": 0.3,
				"transport_adjustment": 0
			}
		}
	]
}
```

Scoring notes:

- Route is segmented into 50-200m chunks.
- Segment risk formula is fully rule-based (no ML).
- Transport mode currently applies a slight calibration (`transport_adjustment`) so future ML behavior remains backward-compatible.
- Design is strategy-based so ML scorer can be introduced later without API changes.

## 3. Development Password Reset Flow

When NODE_ENV is not production, `/api/auth/forgot-password` returns a `resetToken` in response for testing.
Use this token in `/api/auth/reset-password`.

## 4. Production Notes

- Set a strong JWT_SECRET.
- Restrict CORS_ORIGIN to known clients.
- Integrate email provider to send reset links instead of returning token.
- Keep MongoDB secured and network-restricted.
