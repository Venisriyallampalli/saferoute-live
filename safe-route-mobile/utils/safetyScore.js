function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isNightHour(date = new Date()) {
  const hour = date.getHours();
  // Night time defined as 8 PM to 6 AM (same as prompt's -10 logic context)
  return hour >= 20 || hour < 6;
}

/**
 * Placeholder Safety Scoring System
 * FORMULA:
 * Base Score: 60 (to allow room for + adjustments)
 * +30 if police station within proximity (placeholder logic uses count)
 * +20 if hospital within proximity
 * -20 if hazard nearby
 * -10 if night time
 */
export function calculateSafetyScore({
  nearbyHazards = [],
  nearbyPoliceStations = [],
  nearbyHospitals = [],
  date = new Date(),
  preference = 'Well-lit'
} = {}) {
  let score = 60;

  // Base proximity adjustments
  if (nearbyPoliceStations.length > 0) score += 30;
  if (nearbyHospitals.length > 0) score += 20;
  if (nearbyHazards.length > 0) score -= 25;
  if (isNightHour(date)) score -= 15;

  // Preference-based logic adjustments
  if (preference === 'Well-lit' && isNightHour(date)) {
    score -= 10; // Extra penalty at night for this preference
  } else if (preference === 'Crowded' && nearbyPoliceStations.length === 0) {
    score -= 10; // Less safe if user prefers crowded but no police nearby
  } else if (preference === 'Emergency') {
    if (nearbyHospitals.length > 0) score += 15; // Extra bonus for emergency pref
    if (nearbyPoliceStations.length > 0) score += 10;
  }

  return clampScore(score);
}

export function getSafetyLabel(score) {
  if (score >= 70) return 'Safe';
  if (score >= 40) return 'Moderate';
  return 'Risky';
}
