import { createNanoEvents } from 'nanoevents';
import infoIconSvg from '../../../partials/icons/info.svg';
import { idbKeyval as storage } from '../../utils/storage.js';
import { pluginMatches } from '../plugin-filter.js';
import SettingsModel from '../settings-model.js';
import { domReady, strToEl } from '../utils.js';
import MaterialSlider from './material-slider.js';
import Ripple from './ripple.js';

// Which tab is showing and which categories are open is what the panel *looks*
// like, not what it does — so it lives under its own key, well away from
// `settings`. It never enters the settings object, the cache fingerprint or
// `migrateSettings()`.
const uiStateKey = 'panel-ui';

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
    this._notedRows = [];
    this._filterQuery = '';

    // Started here rather than in `domReady` so the read overlaps parsing. It
    // is deliberately not awaited anywhere: unlike the settings restore, this
    // one triggers no compression, so landing a frame late costs nothing — the
    // markup already ships the default layout.
    const uiState = storage.get(uiStateKey).catch((error) => {
      console.warn('Could not restore the panel layout', error);
    });

    domReady.then(() => {
      this.container = document.querySelector('.settings');
      // Six `.plugins` containers: the two stage blocks and one per plugin
      // category. They carry the class on purpose — it's what puts their
      // checkboxes in `_pluginInputs`, and so in `getSettings().plugins`.
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

      this._tabs = [...this.container.querySelectorAll('.settings-tab')];
      this._panels = this._tabs.map((tab) =>
        this.container.querySelector(
          `[id="${CSS.escape(tab.getAttribute('aria-controls'))}"]`,
        ),
      );
      this._activeTab = Math.max(
        0,
        this._tabs.findIndex(
          (tab) => tab.getAttribute('aria-selected') === 'true',
        ),
      );
      // Where each panel was left, so switching away and back returns to it.
      // In memory only: it is a scroll position, not a preference. Both of
      // these belong to `_selectTab()`, so they are set before anything can
      // reach it.
      this._scrollTops = this._tabs.map(() => 0);
      this._scroller = this.container.querySelector('.settings-scroller');

      // One descriptor per category, carrying the rows the filter hides and
      // the header count it keeps up to date. The name is read out of the
      // markup rather than passed in, so the panel and the filter can't
      // disagree about what a row is called.
      this._categories = [
        ...this.container.querySelectorAll('.plugin-category'),
      ].map((details) => ({
        id: details.dataset.category,
        details,
        // The open state this class last wrote, so a `toggle` that disagrees
        // with it can be recognised as the user's own — see `_bindCategories`.
        expected: details.open,
        count: details.querySelector('.plugin-category-count'),
        notice: details.querySelector('.plugin-category-notice'),
        noticeText: details.querySelector('.plugin-category-notice-text'),
        rows: [...details.querySelectorAll('.setting-item-toggle')].map(
          (label) => ({
            label,
            id: label.querySelector('input').name,
            name: label.querySelector('.setting-item-name').textContent,
          }),
        ),
      }));
      // The user's own open state, tracked rather than read back off the DOM:
      // while a query is active the categories are forced open, so the markup
      // stops being the record of what they chose.
      this._openCategories = new Set(
        this._categories
          .filter((category) => category.details.open)
          .map((category) => category.id),
      );

      this._filterInput = this.container.querySelector('.setting-filter-input');
      this._filterCount = this.container.querySelector('.setting-filter-count');
      this._filterEmpty = this.container.querySelector('.setting-filter-empty');

      this._bindTabs();
      this._bindCategories();
      this._filterInput.addEventListener('input', () => this._applyFilter());

      const scroller = this._scroller;
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
      //
      // A `<summary>` is exempt too: it has no `type` at all, so it takes the
      // same early return, and a category header that can't take focus can't
      // be operated from the keyboard afterwards.
      scroller.addEventListener('mousedown', (event) => {
        const control = event.target.closest('input, select, summary');

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

      uiState.then((state) => this._applyUiState(state));
    });
  }

  _bindTabs() {
    for (const [index, tab] of this._tabs.entries()) {
      tab.addEventListener('click', () => {
        this._selectTab(index);
        this._persistUiState();
      });
    }

    this.container
      .querySelector('.settings-tabs')
      .addEventListener('keydown', (event) => {
        const last = this._tabs.length - 1;
        let next;

        switch (event.key) {
          case 'ArrowLeft': {
            next = this._activeTab === 0 ? last : this._activeTab - 1;
            break;
          }

          case 'ArrowRight': {
            next = this._activeTab === last ? 0 : this._activeTab + 1;
            break;
          }

          case 'Home': {
            next = 0;
            break;
          }

          case 'End': {
            next = last;
            break;
          }

          default: {
            return;
          }
        }

        event.preventDefault();
        // Selection follows focus. Both panels are already in the DOM, so
        // there is nothing to load and nothing to be gained by making the
        // reader press a key twice.
        this._selectTab(next, true);
        this._persistUiState();
      });
  }

  _selectTab(index, shouldFocus = false) {
    // The two panels share one scroller, so an offset means something different
    // in each — and the taller panel's offset is clamped to the shorter one's
    // maximum on the way in, which loses it for the way back. Read before the
    // swap and written after it, since hiding a panel reflows the scroller and
    // clamps whatever is there.
    if (index !== this._activeTab) {
      this._scrollTops[this._activeTab] = this._scroller.scrollTop;
    }

    for (const [candidate, tab] of this._tabs.entries()) {
      const isSelected = candidate === index;

      tab.setAttribute('aria-selected', String(isSelected));
      // A roving tabindex: the strip is one tab stop, and the arrow keys move
      // within it.
      tab.tabIndex = isSelected ? 0 : -1;
      // `hidden`, not merely invisible — the inactive panel has to be out of
      // reach of the keyboard and of a screen reader, not just off-screen.
      this._panels[candidate].hidden = !isSelected;

      if (isSelected && shouldFocus) tab.focus();
    }

    this._activeTab = index;
    this._scroller.scrollTop = this._scrollTops[index] ?? 0;
  }

  /**
   * Open or close a category on the panel's own initiative, recording that it
   * was us — see the `toggle` handler in `_bindCategories()`.
   *
   * @param {object} category The category descriptor.
   * @param {boolean} isOpen Whether it should be open.
   */
  _setCategoryOpen(category, isOpen) {
    category.expected = isOpen;
    category.details.open = isOpen;
  }

  _bindCategories() {
    for (const category of this._categories) {
      category.details.addEventListener('toggle', () => {
        // `toggle` fires for programmatic changes as well as clicks, and it
        // fires asynchronously — so a synchronous "we are writing this" flag
        // would be long gone by the time it arrived. Comparing against the
        // state last written tells the two apart exactly: an open state this
        // class didn't ask for is the user's own, whether or not a query is
        // running. That matters, because a category the user collapses while
        // filtering must still be collapsed once the filter clears.
        if (category.details.open === category.expected) return;

        category.expected = category.details.open;

        if (category.details.open) {
          this._openCategories.add(category.id);
        } else {
          this._openCategories.delete(category.id);
        }

        this._persistUiState();
        // Collapsing a category buries its notices, which the header then has
        // to own up to — and the open state is part of the render key. It also
        // takes its rows off the screen, which the filter's count reports.
        this._updateCounts();
        this._renderNotes();
      });
    }
  }

  /**
   * Hide the rows the query rejects, and force open whatever still has
   * something to show. Purely a view pass: nothing here reaches the model, so
   * a hidden plugin is still enabled and still in the fingerprint.
   */
  _applyFilter() {
    const query = this._filterInput.value;

    this._filterQuery = query;

    const isFiltering = query.trim() !== '';
    let matched = 0;

    for (const category of this._categories) {
      let matches = 0;

      for (const row of category.rows) {
        const match = pluginMatches(query, row);

        row.label.hidden = !match;
        if (match) matches++;
      }

      matched += matches;
      category.details.hidden = isFiltering && matches === 0;
      // Opened where there is something to show, so a fresh result never
      // starts out behind a collapsed header; back to whatever the user chose
      // once the query clears. They stay free to collapse it again from here —
      // the count below reports what is actually on screen, not what matched.
      this._setCategoryOpen(
        category,
        isFiltering ? matches > 0 : this._openCategories.has(category.id),
      );
    }

    // The empty message is about matches rather than visibility: collapsing
    // every matching category hides the results, it doesn't mean there weren't
    // any.
    this._filterEmpty.hidden = !isFiltering || matched > 0;
    if (isFiltering && matched === 0) {
      // textContent, not markup: the query is whatever was typed.
      this._filterEmpty.textContent = `Nothing matches “${query.trim()}”.`;
    }

    this._updateCounts();
    // The notices don't move, but which of them a collapsed or filtered row
    // has just buried does.
    this._renderNotes();
  }

  /** Header counts, and the total beside the filter field. */
  _updateCounts() {
    const { plugins } = this._model.get();
    let enabled = 0;
    let total = 0;
    let shown = 0;

    for (const category of this._categories) {
      let on = 0;
      // A row inside a collapsed — or filtered-away — category is not on
      // screen, whatever its own `hidden` says.
      const isOnScreen = category.details.open && !category.details.hidden;

      for (const row of category.rows) {
        if (plugins[row.id]) on++;
        if (isOnScreen && !row.label.hidden) shown++;
      }

      category.count.textContent = `${on}/${category.rows.length}`;
      enabled += on;
      total += category.rows.length;
    }

    // While a query is active the useful number is how much of the list it
    // left; the per-category counts go on saying what is enabled. The element
    // is an `aria-live` region, so whichever it currently is gets announced.
    this._filterCount.textContent = this._filterQuery.trim()
      ? `${shown} of ${total} shown`
      : `${enabled}/${total} enabled`;
  }

  _persistUiState() {
    // Plain keys, deliberately: the page bundle mangles `_`-prefixed
    // properties, and a payload written under mangled names would never be
    // read back.
    storage
      .set(uiStateKey, {
        tab: this._tabs[this._activeTab].getAttribute('aria-controls'),
        openCategories: [...this._openCategories],
      })
      .catch((error) => {
        console.warn('Could not save the panel layout', error);
      });
  }

  _applyUiState(state) {
    if (!state) return;

    const tab = this._tabs.findIndex(
      (candidate) => candidate.getAttribute('aria-controls') === state.tab,
    );

    if (tab !== -1) this._selectTab(tab);

    if (Array.isArray(state.openCategories)) {
      // Filtered against what the panel actually offers: a category that has
      // since been renamed or dropped must not resurrect itself here.
      const known = new Set(this._categories.map((category) => category.id));

      this._openCategories = new Set(
        state.openCategories.filter((id) => known.has(id)),
      );

      for (const category of this._categories) {
        this._setCategoryOpen(category, this._openCategories.has(category.id));
      }
    }

    this._renderNotes();
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
    const stageGroup = this._stageGroups.find(
      (candidate) => candidate.select === event.target,
    );

    // One delegated listener covers the whole panel, so the filter field's
    // keystrokes arrive here too. It is nameless on purpose — like the stage
    // selects handled below, it is not a setting — and leaving before the
    // throttle is cleared keeps it from cancelling a pending emit as well as
    // off the recompression path entirely.
    if (!stageGroup && !event.target.name) return;

    clearTimeout(this._throttleTimeout);

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

    this._updateCounts();
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

    this._updateCounts();
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
    // the text changing. Expanding a category doesn't move anything, but it
    // does decide whether the note or its header count is what gets read.
    const rendered = JSON.stringify([
      notes,
      this._stageGroups.map((group) => group.custom.hidden),
      this._categories.map((category) => category.details.open),
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

    // A note sits after its control's row, so a row the filter hid would leave
    // its note standing there on its own, explaining a control that is no
    // longer on screen. They travel together. Not keyed either: the query can
    // change which rows are hidden without changing a single note.
    for (const { note, row } of this._notedRows) {
      note.hidden = Boolean(row?.hidden);
    }

    // A collapsed category takes its notices out of the accessibility tree
    // along with everything else inside it. Rather than re-homing them the way
    // a stage block does — subtle machinery the categories don't need — the
    // header says how many are in there, in words as well as in colour: the
    // icon carries the same meaning to anyone the tint doesn't reach, and the
    // count goes into the summary's accessible name. Only while collapsed —
    // once it's open the notices speak for themselves.
    for (const category of this._categories) {
      const buried = category.details.open
        ? 0
        : category.details.querySelectorAll('.setting-note:not([hidden])')
            .length;

      category.count.classList.toggle('has-note', buried > 0);
      category.notice.hidden = buried === 0;
      category.noticeText.textContent =
        buried === 1 ? '1 notice' : `${buried} notices`;
    }
  }

  _insertNotes(notes) {
    for (const stale of this.container.querySelectorAll('.setting-note')) {
      stale.remove();
    }

    // Rebuilt alongside the notes rather than walked back out of the DOM
    // afterwards: one host can carry several notices, so adjacency doesn't
    // reliably lead back to the row a note belongs to.
    this._notedRows = [];

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
      this._notedRows.push({
        note,
        row: control.closest('.setting-item-toggle'),
      });
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
