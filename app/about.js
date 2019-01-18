const h = require('hyperscript')

document.body.appendChild(
  h('div#log', [
    h('h3', 'Boot Log')
  ])
)

function log(type, ...args) {
  console.log(...args)
  const el = document.querySelector('#log')
  el.appendChild(h(`div.message.${type}`, args.join(' ')))
}

// API called from Electron process
window.bayofplenty = {
  log
}
