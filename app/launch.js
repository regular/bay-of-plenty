const h = require('mutant/html-element')
const setStyles = require('module-styles')('bop-launch-page')
const pull = require('pull-stream')

const ConsoleMessages = require('tre-console-messages')

const bootKey = decodeURIComponent(document.location.pathname.split('/')[3])
const bootURL = `/boot/${encodeURIComponent(bootKey)}`

styles()

const renderConsole = ConsoleMessages()
const con = renderConsole()
con.setAttribute('open', true)
document.body.appendChild(h('.bop-launch', [
  h('.tab-bar', 'tab bar'),
  h('iframe', {src: bootURL}),
  con
]))

function checkBlob(cb) {
  fetch(bootURL, {
    method: 'HEAD'
  }).then(response => {
    if (!response.ok) {
      console.error('server response for %s: %s', bootURL, response.statusText)
      return
    }
    const etag = response.headers.get('etag')
    console.info('Blob available: %s', etag)
    setTimeout( ()=>{
      cb()
    })
  }).catch(err => {
    console.error('Error requesting HEAD %s: %s', bootURL, err.message)
  })
}

function styles() {
  setStyles(`
    html * {
      padding: 0;
      margin: 0;
      box-sizing: border-box;
    }
    html, body {
      height: 100%;
      overflow: hidden;
    }
    body {
      background-color: #333;
      font-family: sans-serif;
    }
    .bop-launch {
      display: grid;
      grid-template-rows: auto 1fr 4em;
      grid-template-columns: 1fr;
      height: 100%;
      overflow: hidden;
      place-items: stretch;
      place-content: stretch;
    }
    .tab-bar {
      background-color: blue;
      grid-column: 1/2;
      grid-row: 1/2;
    }
    iframe {
      border: none;
      grid-column: 1/2;
      grid-row: 2/3;
    }
    .tre-console-messages {
      grid-column: 1/2;
      grid-row: 3/4;
    }
  `)
}
