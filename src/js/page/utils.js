export const domReady = new Promise((resolve) => {
  function checkState() {
    if (document.readyState !== 'loading') resolve();
  }

  document.addEventListener('readystatechange', checkState);
  checkState();
});

const range = document.createRange();
range.selectNode(document.documentElement);

export function strToEl(str) {
  return range.createContextualFragment(String(str)).firstElementChild;
}

export function readFileAsText(file) {
  return new Response(file).text();
}

function transitionClassFunc({ removeClass = false } = {}) {
  return (element, className = 'active', transitionClass = 'transition') => {
    const hasClass = element.classList.contains(className);

    if (removeClass) {
      if (!hasClass) return Promise.resolve();
    } else if (hasClass) {
      return Promise.resolve();
    }

    const transitionEnd = new Promise((resolve) => {
      const listener = (event) => {
        if (event.target !== element) return;
        element.removeEventListener('transitionend', listener);
        element.classList.remove(transitionClass);
        resolve();
      };

      element.classList.add(transitionClass);

      requestAnimationFrame(() => {
        element.addEventListener('transitionend', listener);
        element.classList.toggle(className, !removeClass);
      });
    });

    const transitionTimeout = new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    return Promise.race([transitionEnd, transitionTimeout]);
  };
}

export const transitionToClass = transitionClassFunc();
export const transitionFromClass = transitionClassFunc({ removeClass: true });

export function trackFocusMethod() {
  let focusMethod = 'mouse';

  document.body.addEventListener(
    'focus',
    (event) => {
      event.target.classList.add(
        focusMethod === 'key' ? 'key-focused' : 'mouse-focused',
      );
    },
    { capture: true },
  );

  document.body.addEventListener(
    'blur',
    (event) => {
      event.target.classList.remove('key-focused', 'mouse-focused');
    },
    { capture: true },
  );

  document.body.addEventListener(
    'keydown',
    () => {
      focusMethod = 'key';
    },
    { capture: true },
  );

  document.body.addEventListener(
    'mousedown',
    () => {
      focusMethod = 'mouse';
    },
    { capture: true },
  );
}
