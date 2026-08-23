const Toast = (() => {
  function ensureStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function show(message, { type = 'success', duration = 4000 } = {}) {
    const stack = ensureStack();
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  return {
    success: (msg) => show(msg, { type: 'success' }),
    error: (msg) => show(msg, { type: 'error' }),
  };
})();
