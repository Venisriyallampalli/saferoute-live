# SafeRoute Live - Mobile Application

SafeRoute Live is a safety-aware navigation and monitoring system designed to improve personal travel safety for women, students, and solo travelers. This mobile application is built with **Expo React Native**.

## Key Features
- **Live Safety Map**: Real-time GPS tracking with safety signal analysis.
- **Safety-Aware Routing**: Computes safety scores using proximity to help and reported hazards.
- **Hazard Reporting**: Crowdsourced reporting for harassment, accidents, and environmental risks.
- **Emergency SOS**: Single-tap broadcast of your live location to trusted contacts.
- **Navigation Mode**: Active tracking and route progress with constant safety monitoring.

## Tech Stack
- **Framework**: Expo (React Native)
- **Styling**: NativeWind (Tailwind CSS)
- **Maps**: React Native Maps (Google Maps / OpenStreetMap)
- **Icons**: Lucide React Native
- **Backend**: Express.js / MongoDB (Node.js)

## Project Structure
- `screens/`: Main application views (Home, Map, Profile, etc.)
- `components/`: Reusable UI components.
- `services/`: API and third-party service integrations (Location, SOS, Hazards).
- `context/`: Authentication and Global state.
- `utils/`: Safety scoring logic and helper functions.

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- Expo Go app on your phone (for testing)

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LOCAL_IP>:3001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_KEY
EXPO_PUBLIC_MAPBOX_TOKEN=YOUR_MAPBOX_TOKEN
```

### 3. Installation
```bash
npm install
```

### 4. Running the App
```bash
npx expo start -c
```
- Scan the QR code with your phone (Expo Go) to open the app.
- Ensure your phone is on the same Wi-Fi network as your computer.

### 5. Backend Requirements
Ensure the **SafeRoute Backend** and **MongoDB** are running for authentication and reporting to work.

## Safety Scoring Formula (Placeholder)
The system currently uses an intelligent rule-based scoring method:
- **Base Score**: 60
- **+30**: If a Police Station is nearby.
- **+20**: If a Hospital is nearby.
- **-20**: If a Hazard is reported nearby.
- **-10**: During night hours (8 PM - 6 AM).

## Emergency Features
The Red SOS button triggers the `sosService` which:
1. Gathers your current GPS coordinates.
2. Identifies your emergency contacts.
3. Broadcasts a safety alert via the backend.
