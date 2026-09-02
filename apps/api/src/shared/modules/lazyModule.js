/**
 * Defers a require until the first property is read.
 *
 * Some features genuinely depend on each other: writing an expense refreshes
 * the alerts, and the alert rules read expenses. Requiring both at load time
 * means whichever loads second gets the other's half-built exports, and the
 * failure shows up much later as "x.fn is not a function".
 *
 * Wrapping the require in a thunk moves it to the first call instead, by which
 * point both modules have finished loading. The loader is passed in rather than
 * a path string so the require still resolves relative to the calling file.
 *
 *   const goals = lazyModule(() => require('../goals/goals.service'));
 *   ...
 *   await goals.listOpen(userId, 5);   // required here, not at import time
 *
 * Only use this for a cycle that is real. A one-way dependency should be a
 * plain require, where a typo fails loudly at start-up.
 */
const lazyModule = (loader) => {
  let loaded = null;
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (!loaded) loaded = loader();
        return loaded[prop];
      },
      has(_target, prop) {
        if (!loaded) loaded = loader();
        return prop in loaded;
      },
    }
  );
};

module.exports = lazyModule;
