import { createNanoEvents } from 'nanoevents';
import { domReady } from '../utils.js';
import MaterialSlider from './material-slider.js';
import Ripple from './ripple.js';
import { deriveStage, metadataStages, stylesStages } from './setting-stages.js';

export default class Settings {
  constructor() {
    this.emitter = createNanoEvents();
    this._throttleTimeout = null;

    domReady.then(() => {
      this.container = document.querySelector('.settings');
      // Three `.plugins` containers now: the two stage blocks and the feature
      // list. The stage blocks carry the class on purpose — it's what puts
      // their checkboxes in `_pluginInputs`, and so in `getSettings().plugins`.
      this._pluginInputs = [
        ...this.container.querySelectorAll('.plugins input'),
      ];
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

        event.preventDefault();
      });

      this._syncStageSelects();
    });
  }

  _onChange(event) {
    clearTimeout(this._throttleTimeout);

    const stageGroup = this._stageGroups.find(
      (candidate) => candidate.select === event.target,
    );

    if (stageGroup) {
      this._applyStage(stageGroup, event.target.value);
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
