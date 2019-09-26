const h = require('mutant/html-element')
const Value = require('mutant/value')
const { ipcRenderer } = require('electron')
const inviteCode = require('tre-invite-code')

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
            config = inviteCode.parse(code)
            if (!config) config = JSON.parse(code)
          } catch(err) {
            return message.set(err.message)
          }
  
          if (config.network) {
            if (!config.capss || !config.caps.shs) {
              config.caps = config.caps || {}
              config.caps.shs = config.network.slice(1).replace(/\.[^.]+$/, '')
            }
          } else {
            config.network = `*${config.caps && config.caps.shs || defaultCap}.random`
          }

          let networks = {}
          try {
            networks = JSON.parse(localStorage.networks || '{}')
          } catch(e) {}
          networks[config.network] = config
          localStorage.networks = JSON.stringify(networks)
          cb(null, networks)
        }
      }, 'Apply')
    ])
  )
}
