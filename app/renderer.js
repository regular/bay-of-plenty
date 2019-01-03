const h = require('mutant/html-element')
const Value = require('mutant/value')
const { ipcRenderer } = require('electron')

getNetworks( (err, networks) => {
  ipcRenderer.send('networks', err, networks)
})

function getNetworks(cb) {
  let networks = {}
  try {
    networks = JSON.parse(localStorage.networks || '{}')
  } catch(e) {}
  if (Object.keys(networks).length) {
    return cb(null, networks)
  }

  let textarea
  const message = Value('Please paste your invite code')

  document.body.appendChild(
    h('div', [
      h('.message', message),
      textarea = h('textarea'),
      h('button', {
        'ev-click': e => {
          const code = textarea.value
          let config
          try {
            config = JSON.parse(code)
          } catch(err) {
            return message.set(err.message)
          }
          let networks = {}
          try {
            networks = JSON.parse(localStorage.networks || '{}')
          } catch(e) {}
          networks[config.caps && config.caps.shs || 'default'] = config
          localStorage.networks = JSON.stringify(networks)
          cb(null, networks)
        }
      }, 'Apply')
    ])
  )
}
