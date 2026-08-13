import { createNanoEvents } from 'nanoevents';
import { domReady } from '../utils.js';
import MaterialSlider from './material-slider.js';
import Ripple from './ripple.js';
import { deriveMetadataStage, metadataStages } from './metadata-stages.js';

export default class Settings {
  constructor() {
    this.emitter = createNanoEvents();
    this._throttleTimeout = null;

    domReady.then(() => {
      this.container = document.querySelector('.settings');
      // Two `.plugins` containers now: the metadata block and the feature list.
      this._pluginInputs = [
        ...this.container.querySelectorAll('.plugins input'),
      ];
      this._globalInputs = [
        ...this.container.querySelectorAll('input[name], select[name]'),
      ].filter((element) => !element.closest('.plugins'));

      this._metadataSelect = this.container.querySelector('.metadata-select');
      this._metadataCustom = this.container.querySelector('.metadata-custom');
      this._metadataInputs = [
        ...this._metadataCustom.querySelectorAll('input'),
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
      scroller.addEventListener('mousedown', (event) => {
        if (
          event.target.closest('input[type=range], input[type=text], select')
        ) {
          return;
        }

        event.preventDefault();
      });

      this._syncMetadataSelect();
    });
  }

  _onChange(event) {
    clearTimeout(this._throttleTimeout);

    if (event.target === this._metadataSelect) {
      this._applyMetadataStage(event.target.value);
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
  _applyMetadataStage(stage) {
    const combination = metadataStages[stage];

    if (combination) {
      for (const inputEl of this._metadataInputs) {
        inputEl.checked = combination[inputEl.name];
      }
    }

    this._metadataCustom.hidden = stage !== 'custom';
  }

  _syncMetadataSelect() {
    const stage = deriveMetadataStage(
      Object.fromEntries(
        this._metadataInputs.map((inputEl) => [inputEl.name, inputEl.checked]),
      ),
    );

    this._metadataSelect.value = stage;
    this._metadataCustom.hidden = stage !== 'custom';
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

    // The metadata select has no name of its own, so it follows the checkboxes.
    this._syncMetadataSelect();

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

    this._syncMetadataSelect();
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
