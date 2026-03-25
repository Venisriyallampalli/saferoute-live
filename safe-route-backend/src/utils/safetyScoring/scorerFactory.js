const { RuleBasedSafetyScorer } = require('./ruleBasedScorer');

function createSafetyScorer(kind = 'rule-based') {
  const scorerType = String(kind || '').toLowerCase();

  // ML scorer can be plugged in here later while keeping controller and API stable.
  if (scorerType === 'ml') {
    throw new Error('ML scorer is not enabled yet. Use rule-based scorer for now.');
  }

  return new RuleBasedSafetyScorer();
}

module.exports = {
  createSafetyScorer,
};
