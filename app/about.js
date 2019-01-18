const h = require('hyperscript')

document.body.appendChild(
  h('div#log', [
    h('h3', 'Boot Log'),
    h('.container')
  ])
)

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
}

// API called from Electron process
window.bayofplenty = {
  log
}
