class BaseSafetyScorer {
  // Subclasses should return a complete route safety result object.
  // eslint-disable-next-line no-unused-vars
  scoreRoute(route, context) {
    throw new Error('scoreRoute must be implemented by a concrete scorer');
  }
}

module.exports = BaseSafetyScorer;
