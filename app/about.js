const h = require('hyperscript')
const setStyles = require('module-styles')('bayofplenty')

setStyles(`
  ul.versions {
    display: grid;
    grid-template-rows: repeat(5, 1fr);
    grid-template-columns: 1fr 1fr 1fr;
    grid-auto-flow: row;
  }
  body {
    font-family: sans-serif;
  }
  div#log {
    max-height: 15em;
    overflow-y: scroll;
    font-family: monospace;
  }
`)

checkBlob()

document.body.appendChild(
  h('div#log', [
    h('h3', 'Boot Log'),
    h('.container')
  ])
)

function checkBlob() {
  const el = h('.boot', 'checking blob ...')
  document.body.appendChild(el)
  fetch('/boot', {
    method: 'HEAD'
  }).then(response => {
    if (!response.ok) {
      log('error', 'Server response for /boot', response.statusText)
      el.innerText = response.statusText
      return
    }
    const etag = response.headers.get('etag')
    log('important', `Blob available: ${etag}`)
    el.innerText = etag
    setTimeout( ()=>{
      location.href = '/boot'
    })
  }).catch(err => {
    log('error', 'Failure requesting HEAD /boot', err.message)
    el.innerText = 'FAIL'
  })
}

function log(type, ...args) {
  console.log(type, args.join(' '))
  const el = document.querySelector('#log .container')
  if (!el) {
    console.error('#log element not found.')
    return false
  }
  el.appendChild(
    h(`div.message.${type}`, 
      [type, ...args.map(x => h('span', x))]
    )
  )
  const p = el.parentElement
  p.scrollTop = p.scrollHeight
}

// API called from Electron process
window.bayofplenty = {
  log
}
