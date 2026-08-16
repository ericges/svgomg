import { createNanoEvents } from 'nanoevents';
import infoIconSvg from '../../../partials/icons/info.svg';
import SettingsModel from '../settings-model.js';
import { domReady, strToEl } from '../utils.js';
import MaterialSlider from './material-slider.js';
import Ripple from './ripple.js';

// The panel, and nothing but the panel: what a setting *is* lives in
// `page/settings-model.js`, which has no DOM in it and is unit-tested. This
// class binds the two together — it writes the model into the controls, reads
// the controls back into the model, and owns the notice markup.
export default class Settings {
  constructor() {
    this.emitter = createNanoEvents();
    this._throttleTimeout = null;
    this._model = new SettingsModel();
    this._renderedNotes = '';

    domReady.then(() => {
      this.container = document.querySelector('.settings');
      // Three `.plugins` containers: the two stage blocks and the feature
      // list. The stage blocks carry the class on purpose — it's what puts
      // their checkboxes in `_pluginInputs`, and so in `getSettings().plugins`.
      // Document order is fine here; the model emits the map and the
      // fingerprint in canonical pipeline order for itself.
      this._pluginInputs = [
        ...this.container.querySelectorAll('.plugins input'),
      ];
      this._globalInputs = [
        ...this.container.querySelectorAll('input[name], select[name]'),
      ].filter((element) => !element.closest('.plugins'));

      // Both selects are sugar with no `name` of their own, so the settings
      // object never sees them: each writes the checkboxes in its block, and
      // the model derives its value back from them.
      const stageGroup = (name, selectClass, customClass) => ({
        name,
        select: this.container.querySelector(selectClass),
        custom: this.container.querySelector(customClass),
      });

      this._stageGroups = [
        stageGroup('metadata', '.metadata-select', '.metadata-custom'),
        stageGroup('styles', '.styles-select', '.styles-custom'),
      ];

      const scroller = this.container.querySelector('.settings-scroller');
      const resetBtn = this.container.querySelector('.setting-reset');
      const ranges = this.container.querySelectorAll('input[type=range]');

      this._resetRipple = new Ripple();
      resetBtn.append(this._resetRipple.container);

      // map real range elements to Slider instances
      this._sliderMap = new WeakMap();

      // enhance ranges
      for (const range of ranges) {
        this._sliderMap.set(range, new MaterialSlider(range));
      }

      this.container.addEventListener('input', (event) =>
        this._onChange(event),
      );
      resetBtn.addEventListener('click', () => this._onReset());

      // TODO: revisit this
      // Stop double-tap text selection.
      // This stops all text selection which is kinda sad.
      // I think this code will bite me.
      // The exceptions are controls that need the mousedown to focus or open
      // them — preventing it leaves the text field unfocusable.
      //
      // Matched on the `type` DOM *property*, not an attribute selector:
      // `type=text` is the HTML default, so `removeRedundantAttributes` strips
      // it and `input[type=text]` matches nothing in a production build. The
      // property still reads 'text'. Checkboxes are deliberately not exempt —
      // they're visually hidden, so the mousedown lands on their label.
      scroller.addEventListener('mousedown', (event) => {
        const control = event.target.closest('input, select');

        if (control && control.type !== 'checkbox') return;

        // Moving focus is the default action being cancelled here, so without
        // this focus doesn't just skip the click target — it stays put, and
        // the last field clicked keeps its ring until another control takes
        // it. Blurring unconditionally is what the default would have done.
        document.activeElement?.blur();
        event.preventDefault();
      });

      // The markup ships the model's defaults as its initial attributes, so
      // this paints nothing new — but it is also the flush for anything
      // restored before the DOM was ready, which reaches the model alone.
      this._syncDom();
      this._renderNotes();
    });
  }

  /**
   * The document each guarded plugin saw, from the probes the worker ran
   * alongside the optimisation. The collision notices are gated on it — see
   * `setting-notes.js`.
   *
   * @param {object} [collisions] Keyed by plugin name; null between files.
   */
  setCollisions(collisions) {
    this._model.setCollisions(collisions);
    this._renderNotes();
  }

  _onChange(event) {
    clearTimeout(this._throttleTimeout);

    const stageGroup = this._stageGroups.find(
      (candidate) => candidate.select === event.target,
    );

    if (stageGroup) {
      this._applyStage(stageGroup, event.target.value);
      // After the stage has written its checkboxes: the notices read the
      // settings those produce, not the select. Never throttled — a note that
      // lags the control it sits under reads as a note about something else.
      this._renderNotes();
      this.emitter.emit('change');
      return;
    }

    const control = event.target;

    // Routed one control at a time rather than through the model's `set()`,
    // which re-derives the stage selects: an edit made by hand must leave the
    // block it belongs to open. See `SettingsModel.setPlugin()`.
    if (control.closest('.plugins')) {
      this._model.setPlugin(control.name, control.checked);
    } else {
      this._model.setGlobal(
        control.name,
        control.type === 'checkbox' ? control.checked : control.value,
      );
    }

    this._renderNotes();

    // throttle range dragging and typing
    if (control.type === 'range' || control.type === 'text') {
      this._throttleTimeout = setTimeout(
        () => this.emitter.emit('change'),
        150,
      );
    } else {
      this.emitter.emit('change');
    }
  }

  _applyStage(group, stage) {
    this._model.setStage(group.name, stage);

    const { plugins } = this._model.get();

    for (const inputEl of group.custom.querySelectorAll('input')) {
      inputEl.checked = plugins[inputEl.name];
    }

    group.custom.hidden = stage !== 'custom';
  }

  /** Push the whole model into the controls. Fires no events. */
  _syncDom() {
    const settings = this._model.get();

    for (const inputEl of this._globalInputs) {
      if (inputEl.type === 'checkbox') {
        inputEl.checked = settings[inputEl.name];
      } else if (inputEl.type === 'range') {
        this._sliderMap.get(inputEl).value = settings[inputEl.name];
      } else {
        inputEl.value = settings[inputEl.name];
      }
    }

    for (const inputEl of this._pluginInputs) {
      inputEl.checked = settings.plugins[inputEl.name];
    }

    for (const group of this._stageGroups) {
      const stage = this._model.stageOf(group.name);

      group.select.value = stage;
      group.custom.hidden = stage !== 'custom';
    }
  }

  /**
   * A notice sits *after* the control's `<label>`, never inside it — the label
   * is the click target for its own checkbox. One exception: a checkbox in a
   * collapsed stage block has no visible row of its own, so its notice goes to
   * the select that stands in for the block — and is described by that select
   * too, since the checkbox it belongs to is `hidden` and reaches nobody.
   *
   * @param {Element} control The input or select the notice is about.
   * @returns {{host: Element, describedBy: Element}} Where the notice goes, and the control it explains to assistive technology.
   */
  _noteTargets(control) {
    const group = this._stageGroups.find((candidate) =>
      candidate.custom.contains(control),
    );
    const visible = group?.custom.hidden ? group.select : control;

    return { host: visible.closest('label'), describedBy: visible };
  }

  _renderNotes() {
    if (!this.container) return;

    const notes = this._model.notes();
    const isPending = this._model.pending;

    // Re-rendering identical notes on every keystroke would tear them off the
    // panel and put them straight back. Where each note *goes* is part of that
    // sameness: expanding a stage block moves its notices from the block's
    // select onto the checkboxes that just became visible, without a word of
    // the text changing.
    const rendered = JSON.stringify([
      notes,
      this._stageGroups.map((group) => group.custom.hidden),
    ]);

    if (rendered !== this._renderedNotes) {
      this._renderedNotes = rendered;
      this._insertNotes(notes);
    }

    // Never part of the key: toggling a class leaves the elements in place, so
    // the styling can hold off long enough that a quick recompression never
    // shows it at all. The label carries the same caveat in words, for the
    // reader the dimming doesn't reach.
    for (const note of this.container.querySelectorAll('.setting-note')) {
      note.classList.toggle('pending', isPending);
      note.querySelector('.setting-note-pending-label').textContent = isPending
        ? ' (still describing the previous run)'
        : '';
    }
  }

  _insertNotes(notes) {
    for (const stale of this.container.querySelectorAll('.setting-note')) {
      stale.remove();
    }

    for (const control of this.container.querySelectorAll(
      '[aria-describedby]',
    )) {
      control.removeAttribute('aria-describedby');
    }

    for (const { name, text } of notes) {
      const control = this.container.querySelector(
        `[name="${CSS.escape(name)}"]`,
      );
      if (!control) continue;

      const id = `setting-note-${name}`;
      const note = strToEl(
        `<p class="setting-note" id="${id}">${infoIconSvg}<span><span class="setting-note-text"></span><span class="setting-note-pending-label"></span></span></p>`,
      );

      // textContent, not markup: the messages name constructs like `<style>`.
      note.querySelector('.setting-note-text').textContent = text;

      const { host, describedBy } = this._noteTargets(control);
      // Appended, not assigned: one collapsed stage block can host the notices
      // of more than one of its checkboxes, and its select then describes them
      // all.
      const described = describedBy.getAttribute('aria-describedby');

      describedBy.setAttribute(
        'aria-describedby',
        described ? `${described} ${id}` : id,
      );
      host.after(note);
    }
  }

  _onReset() {
    this._resetRipple.animate();
    const oldSettings = this.getSettings();

    this._model.reset();
    // The stage selects have no name of their own, so they follow the
    // checkboxes.
    this._syncDom();
    this._renderNotes();

    this.emitter.emit('reset', oldSettings);
    this.emitter.emit('change');
  }

  setSettings(settings) {
    this._model.set(settings);

    if (!this.container) return;

    this._syncDom();
    this._renderNotes();
  }

  getSettings() {
    return this._model.get();
  }
}
