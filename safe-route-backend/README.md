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
- POST /api/safety/route-score

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
			"coordinates": [
				{ "latitude": 12.97, "longitude": 77.59 },
				{ "latitude": 12.98, "longitude": 77.61 }
			]
		}
	],
	"segment_length_m": 100,
	"weather_api_key": "optional_if_set_in_env"
}
```

Response:

```json
{
	"scorer": "rule-based",
	"updated_at": "2026-03-24T12:34:56.000Z",
	"routes": [
		{
			"route_id": "route-0",
			"safety_score": 78,
			"safety_label": "Moderate",
			"factors": {
				"crime": 0.54,
				"accident": 0.46,
				"weather": 0.3,
				"traffic": 0.49,
				"hazard": 0.15
			}
		}
	]
}
```

Scoring notes:

- Route is segmented into 50-200m chunks.
- Segment risk formula is fully rule-based (no ML).
- Design is strategy-based so ML scorer can be introduced later without API changes.

## 3. Development Password Reset Flow

When NODE_ENV is not production, `/api/auth/forgot-password` returns a `resetToken` in response for testing.
Use this token in `/api/auth/reset-password`.

## 4. Production Notes

- Set a strong JWT_SECRET.
- Restrict CORS_ORIGIN to known clients.
- Integrate email provider to send reset links instead of returning token.
- Keep MongoDB secured and network-restricted.
