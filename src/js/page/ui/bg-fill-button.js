import bgFillIconSvg from '../../../partials/icons/bg-fill.svg';
import FloatingActionButton from './floating-action-button.js';

export default class BgFillButton extends FloatingActionButton {
  constructor() {
    const title = 'Preview on vivid background';

    super({
      title,
      iconSvg: bgFillIconSvg,
    });
  }

  onClick(event) {
    super.onClick(event);

    if (this.container.classList.contains('active')) {
      this.container.classList.remove('active');
      document.documentElement.classList.remove('bg-dark');
    } else {
      this.container.classList.add('active');
      document.documentElement.classList.add('bg-dark');
    }
  }
}
