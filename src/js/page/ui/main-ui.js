import { transitionToClass } from '../utils.js';

export default class MainUi {
  _activated = false;

  constructor(...elements) {
    this._toActivate = elements;
  }

  activate() {
    if (this._activated) return;
    this._activated = true;

    return Promise.all(
      this._toActivate.map((element) => transitionToClass(element)),
    );
  }
}
