import { createNanoEvents } from 'nanoevents';
import infoIconSvg from '../../../partials/icons/info.svg';
import { pluginOrder } from '../../svgo-worker/plugin-order.js';
import { domReady, strToEl } from '../utils.js';
import MaterialSlider from './material-slider.js';
import Ripple from './ripple.js';
import { deriveStage, metadataStages, stylesStages } from './setting-stages.js';
import { collectNotes } from './setting-notes.js';

export default class Settings {
  constructor() {
    this.emitter = createNanoEvents();
    this._throttleTimeout = null;
    // What each guarded plugin saw when it last ran, for the collision notices.
    // Undefined until `MainController` has an optimised file to describe, which
    // is also what keeps the notices off an app that has nothing open.
    this._collisions = undefined;
    this._renderedNotes = '';

    domReady.then(() => {
      this.container = document.querySelector('.settings');
      // Three `.plugins` containers now: the two stage blocks and the feature
      // list. The stage blocks carry the class on purpose — it's what puts
      // their checkboxes in `_pluginInputs`, and so in `getSettings().plugins`.
      //
      // Sorted into canonical pipeline order (`plugin-order.js`), not kept in
      // document order: `buildPlugins()` decides the execution order for
      // itself, but emitting the map — and the fingerprint built from it — in
      // that same order keeps a mid-update worker from an older build running
      // the panel's layout as a pipeline, and keeps two visual arrangements
      // of the same settings from producing different cache keys. An unknown
      // `name` shouldn't exist; it sorts last rather than throwing.
      const pluginIndex = new Map(pluginOrder.map((id, index) => [id, index]));

      this._pluginInputs = [
        ...this.container.querySelectorAll('.plugins input'),
      ];
      // In-place `sort`, not `toSorted`: the build minifies without
      // transpiling, and this line runs in the boot path — an ES2023-only
      // method here costs the whole panel in a browser that otherwise runs
      // everything on it. The array is the spread's own copy, so the mutation
      // reaches nobody. (As a bare statement the sort passes
      // `unicorn/no-array-sort`, which only flags sorts posing as copies.)
      this._pluginInputs.sort(
        (a, b) =>
          (pluginIndex.get(a.name) ?? pluginOrder.length) -
          (pluginIndex.get(b.name) ?? pluginOrder.length),
      );
      this._globalInputs = [
        ...this.container.querySelectorAll('input[name], select[name]'),
      ].filter((element) => !element.closest('.plugins'));

      // Both selects are sugar with no `name` of their own, so `getSettings()`
      // never sees them: each writes the checkboxes in its block and derives
      // its own value back from them.
      const stageGroup = (stages, selectClass, customClass) => {
        const custom = this.container.querySelector(customClass);

        return {
          stages,
          select: this.container.querySelector(selectClass),
          custom,
          inputs: [...custom.querySelectorAll('input')],
        };
      };

      this._stageGroups = [
        stageGroup(metadataStages, '.metadata-select', '.metadata-custom'),
        stageGroup(stylesStages, '.styles-select', '.styles-custom'),
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

      this._syncStageSelects();
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
    this._collisions = collisions;
    this._renderNotes();
  }

  _onChange(event) {
    clearTimeout(this._throttleTimeout);

    const stageGroup = this._stageGroups.find(
      (candidate) => candidate.select === event.target,
    );

    if (stageGroup) this._applyStage(stageGroup, event.target.value);

    // After the stage has written its checkboxes: the notices read the settings
    // those produce, not the select. Never throttled — a note that lags the
    // control it sits under reads as a note about something else.
    this._renderNotes();

    if (stageGroup) {
      this.emitter.emit('change');
      return;
    }

    // throttle range dragging and typing
    if (event.target.type === 'range' || event.target.type === 'text') {
      this._throttleTimeout = setTimeout(
        () => this.emitter.emit('change'),
        150,
      );
    } else {
      this.emitter.emit('change');
    }
  }

  // Picking a stage writes the checkboxes it stands for. Deliberately not the
  // reverse: toggling a checkbox by hand leaves the select on 'custom' even if
  // the combination happens to match a stage, so the block doesn't snap shut
  // mid-edit. Deriving is for programmatic restores only.
  _applyStage(group, stage) {
    const combination = group.stages[stage];

    if (combination) {
      for (const inputEl of group.inputs) {
        inputEl.checked = combination[inputEl.name];
      }
    }

    group.custom.hidden = stage !== 'custom';
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

    const settings = this.getSettings();
    const notes = collectNotes(settings, this._collisions?.subjects);
    // The report describes the settings it was produced under. Anything else
    // changed upstream of a subject — enabling "Remove metadata" on a file
    // whose script sits inside it, say — can only be answered by the run
    // that's already on its way, so until it lands the notices are marked as
    // describing the previous one rather than silently reinterpreted.
    const isPending =
      Boolean(this._collisions) &&
      this._collisions.fingerprint !== settings.fingerprint;

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

  _syncStageSelects() {
    for (const group of this._stageGroups) {
      const stage = deriveStage(
        group.stages,
        Object.fromEntries(
          group.inputs.map((inputEl) => [inputEl.name, inputEl.checked]),
        ),
      );

      group.select.value = stage;
      group.custom.hidden = stage !== 'custom';
    }
  }

  _onReset() {
    this._resetRipple.animate();
    const oldSettings = this.getSettings();

    // Set all inputs according to their initial attributes
    for (const inputEl of this._globalInputs) {
      if (inputEl.type === 'checkbox') {
        inputEl.checked = inputEl.hasAttribute('checked');
      } else if (inputEl.type === 'range') {
        this._sliderMap.get(inputEl).value = inputEl.getAttribute('value');
      } else if (inputEl.tagName === 'SELECT') {
        for (const option of inputEl.options) {
          option.selected = option.defaultSelected;
        }
      } else {
        inputEl.value = inputEl.defaultValue;
      }
    }

    for (const inputEl of this._pluginInputs) {
      inputEl.checked = inputEl.hasAttribute('checked');
    }

    // The stage selects have no name of their own, so they follow the
    // checkboxes.
    this._syncStageSelects();
    this._renderNotes();

    this.emitter.emit('reset', oldSettings);
    this.emitter.emit('change');
  }

  setSettings(settings) {
    for (const inputEl of this._globalInputs) {
      if (!(inputEl.name in settings)) continue;

      if (inputEl.type === 'checkbox') {
        inputEl.checked = settings[inputEl.name];
      } else if (inputEl.type === 'range') {
        this._sliderMap.get(inputEl).value = settings[inputEl.name];
      } else {
        inputEl.value = settings[inputEl.name];
      }
    }

    for (const inputEl of this._pluginInputs) {
      if (!(inputEl.name in settings.plugins)) continue;
      inputEl.checked = settings.plugins[inputEl.name];
    }

    this._syncStageSelects();
    this._renderNotes();
  }

  getSettings() {
    // fingerprint is used for cache lookups
    const fingerprint = [];
    const output = {
      plugins: {},
    };

    for (const inputEl of this._globalInputs) {
      if (inputEl.name !== 'gzip' && inputEl.name !== 'original') {
        if (inputEl.type === 'checkbox') {
          fingerprint.push(Number(inputEl.checked));
        } else {
          fingerprint.push(`|${inputEl.value}|`);
        }
      }

      output[inputEl.name] =
        inputEl.type === 'checkbox' ? inputEl.checked : inputEl.value;
    }

    for (const inputEl of this._pluginInputs) {
      fingerprint.push(Number(inputEl.checked));
      output.plugins[inputEl.name] = inputEl.checked;
    }

    output.fingerprint = fingerprint.join(',');

    return output;
  }
}
