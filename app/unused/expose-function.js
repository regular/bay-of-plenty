/* modified exposeFunction from puppeteer/lib/Page.js

*/
module.exports = function(page) {
  const _pageBindings = new Map()
  return function exposeFunctionAgain(name, puppeteerFunction) {
    const expression = `(${addPageBinding.toString()})("${name}")`;
    return page.evaluate(expression)

    function addPageBinding(bindingName) {
      console.log('MY ADDING page binding', bindingName, 'on', document.location.href)
      const win = window;
      const binding = win[`${bindingName}`];
      console.log('binding', binding.toString())
      win[bindingName] = (...args) => {
        const me = window[bindingName];
        let callbacks = me.callbacks;
        if (!callbacks) {
          callbacks = new Map();
          me.callbacks = callbacks;
        }
        const seq = (me.lastSeq || 0) + 1;
        me.lastSeq = seq;
        const promise = new Promise((resolve, reject) => callbacks.set(seq, { resolve, reject }));
        binding(JSON.stringify({ name: bindingName, seq, args }));
        return promise;
      };
    }
  }
}
