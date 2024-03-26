class DarkModeScript{
  static String getScript(bool dark){
    return """
class DarkModeMediaQueryList {
  _matches;
  _query = '(prefers-color-scheme: dark)';
  _eventList = new Set();
  onchange = null;
  constructor(matches) {
    this._matches = matches;
  }
  get media() {
    return this._query;
  }
  get matches() {
    return this._matches;
  }
  updateMatches(matches) {
    if (this._matches === matches) return;
    this._matches = matches;
    this.dispatchEvent(new Event('change'));
  }
  addListener(callback) {
    if (!callback) return;
    this._eventList.add(callback);
  }
  removeListener(callback) {
    if (!callback) return;
    this._eventList.delete(callback);
  }
  addEventListener(type, listener, _options) {
    if (type !== 'change') return;
    if (typeof listener !== 'function') return;
    this._eventList.add(listener);
  }
  removeEventListener(type, listener, _options) {
    if (type !== 'change') return;
    if (typeof listener !== 'function') return;
    this._eventList.delete(listener);
  }
  dispatchEvent(event) {
    const _event = {
      ...event,
      matches: this._matches,
      media: this._query
    };
    if (event.type === 'change') {
      for (const callback of this._eventList) {
        callback.call(this, _event);
      }
    }
    this.onchange && this.onchange.call(this, _event);
    return true;
  }
}
window.originMatchMedia = window.matchMedia;
window.customDarkModeMediaQueryList = new DarkModeMediaQueryList(${dark ? 'true' : 'false'});
window.matchMedia = function (query) {
  if (query === '(prefers-color-scheme: dark)') {
    return customDarkModeMediaQueryList;
  }
  return originMatchMedia(query);
};
    """;
  }
}