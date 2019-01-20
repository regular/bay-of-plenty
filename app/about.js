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
    font-size: 16pt;
  }
  div#log .message {
    font-weight: bold;
  }
  div#log .message.info {
    font-weight: normal;
  }
  div#log span {
    margin-left: .6em;
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
}, 5000)

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
      log({
        level: 'error', 
        plug: 'boot',
        verb: 'Server response for /boot',
        data: [response.statusText]
      })
      el.innerText = response.statusText
      activityIndicator.style.display = 'none'
      return
    }
    const etag = response.headers.get('etag')
    log({
      level: 'notice', 
      plug: 'boot',
      verb: 'Blob available',
      data: [etag]
    })
    el.innerText = `boot blob is available: ${etag}`
    setTimeout( ()=>{
      location.href = '/boot'
    })
  }).catch(err => {
    log({
      level: 'error', 
      plug: 'boot',
      verb: 'Error requesting HEAD /boot',
      data: [err.message]
    })
    el.innerText = 'FAIL'
    activityIndicator.style.display = 'none'
  })
}

function log(msg) {
  let {level, plug, id, verb, data} = msg
  id = id && id.substr(0,15) || ''
  if (!data) data = []
  if (!Array.isArray(data)) data = [data]
  console.log(level, plug, id, verb, data.join(' '))
  const el = document.querySelector('#log .container')
  if (!el) {
    console.error('#log element not found.')
    return false
  }
  el.appendChild(
    h(`div.message.${level}.${plug}`, 
      [level, plug, id, verb, data.join(' ')].map(x => h('span', x))
    )
  )
  const p = el.parentElement
  p.scrollTop = p.scrollHeight
}

// API called from Electron process
window.bayofplenty = {
  log
}
