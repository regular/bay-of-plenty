const h = require('hyperscript')
const setStyles = require('module-styles')('bayofplenty')
const ActivityIndicator = require('tre-activity-indicator')

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
  body {
    display: grid;
    grid-template-rows: 1fr;
    grid-template-columns: 1fr;
    height: 100%;
  }
  .bayofplenty {
    grid-row: 1;
    grid-column: 1;
    opacity: 0;
  }
  img.tre-activityIndicator {
    grid-row: 1;
    grid-column: 1;
    place-self: center center;
    opacity: .4;
  }
`)

const activityIndicator = ActivityIndicator({
  width: 150,
  height: 150,
  color: '#777'
})
document.body.appendChild(activityIndicator)

const container = document.querySelector('.bayofplenty')
checkBlob(container, activityIndicator)

setTimeout( ()=>{
  container.style.opacity = 1
}, 2000)

container.appendChild(
  h('div#log', [
    h('h3', 'Boot Log'),
    h('.container')
  ])
)

function checkBlob(container, activityIndicator) {
  const el = h('.boot', 'checking blob ...')
  container.appendChild(el)
  fetch('/boot', {
    method: 'HEAD'
  }).then(response => {
    if (!response.ok) {
      log('error', 'Server response for /boot', response.statusText)
      el.innerText = response.statusText
      activityIndicator.style.display = 'none'
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
    activityIndicator.style.display = 'none'
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
