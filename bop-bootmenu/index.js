const {client} = require('tre-client')
const styles = require('module-styles')('bop-bootmenu')
const h = require('mutant/html-element')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const debug = require('debug')('bop-bootmenu')
const {parse} = require('tre-invite-code')

client( (err, ssb, config) =>{
  if (err) return console.error(err)

  const versions = Value()
  getVersions(ssb, config, (err, v) =>{
    versions.set(v)
  })

  const entries = MutantArray()
  loadEntries(entries)

  entries(entries => {
    localStorage.entries = JSON.stringify(entries)
  })

  const networks = computed(entries, entries => {
    return Object.keys(entries.reduce((acc, {invite})=>{
      const parsed = parse(invite)
      console.log(parsed)
      if (parsed) acc[parsed.network] = true
      return acc
    }, {})).sort()
  })

  let addAppEl

  document.body.appendChild(
    h('div.bop-bootmenu', [
      computed(networks, networks=>{
        return [
          h('h1', networks.length == 0 ?
            'Please enter invite code' :
            'Select application to start'
          ),
          h('ul.networks', networks.map(netkey => {
            return h('li', [
              h('details', {open: true}, [
                h('summary', [
                  h('span', 'Network: '),
                  h('span.netkey', netkey)
                ]),
                renderAppsOfNetwork(netkey)
              ])
            ]) 
          }))
        ]
      }),
      h('.add-app', [
        h('details', {
          open: computed(networks, netkeys => {
            return !netkeys || netkeys.length == 0
          })
        }, [
          h('summary', [
            h('span', 'Add application')
          ]),
          makeInviteForm()
        ])
      ]),
      h('div.versions', versions)
    ])
  )


  function renderAppsOfNetwork(netkey) {
    return h('ul.apps', MutantMap(entries, e=>{
      const {webapp, invite} = e
      const parsed = parse(invite)
      if (!parsed) return []
      if (parsed.network !== netkey) return []
      return h('li', {
        'ev-click': ev=>{
          ssb.bayofplenty.openApp(invite, (err, result)=>{
            if (err) return
            const {url} = result
            document.location.href = url
          })
        }
      }, [ 
        h('div.name', webapp.value.content.name),
        h('div.description', webapp.value.content.description)
      ])
    }))
  }

  function makeInviteForm() {
    let textarea, button

    return h('div.invite-entry', [
      h('form', {
        action: "/add-network"
      }, [
        textarea = h('textarea', {
          name: "code",
          autocomplete: "off",
          autoficus: true,
          cols: 50,
          rows: 6,
          required: true,
          spellcheck: "false",
          wrap: "hard",
          placeholder: "Your invite code goes here",
          'ev-input': ev => {
            const ok = Boolean(parse(textarea.value.replace(/\s/g,'')))
            button.disabled = !ok
          }
        }),
        h('.bbuton-container', [
          button = h('button', {
            'ev-click': ev=>{
              setTimeout( ()=>{
                button.disabled = true
              }, 1)
              const code = textarea.value
              console.log('invite code', code)
              ev.preventDefault()
              ssb.bayofplenty.openApp(code, (err, result)=>{
                if (err) {
                  console.error(`openApp failed: ${err.message}`)
                  button.disabled = false
                  return
                }
                const {webapp, url} = result
                console.log(`WEBAPP: ${webapp.value.content.name}`)
                entries.push({webapp, invite: code})
                console.log('Loading app ...')
                document.location.href= url
              })
            }
          }, 'Apply')
        ])
      ])
    ])
  }
})

// -- util

function loadEntries(entries) {
  let _entries = []
  try {
    _entries = JSON.parse(localStorage.entries)
    entries.set(_entries || [])
  } catch(e) {}
}

function getVersions(ssb, config, cb) {
  const sep = ' • '
  const copyright = 'Copyright 2019 Jan Bölsche'
  let result = []

  function postProc(result) {
    if (result.length && result[0].startsWith('Bay')) {
      result = [result[0]].concat([copyright]).concat(result.slice(1))
    } else {
      result.unshift(copyright)
    }
    return result.join(sep)
  }

  if (config && config.bootMsgRevision) {
    result.push(`BOP Bootmenu ${shorter(config.bootMsgRevision || 'n/a')}`)
  }
  if (!ssb.bayofplenty) return cb(null, postProc(result))
  ssb.bayofplenty.versions((err, versions)=>{
    if (err) return cb(err)
    const {node, modules, electron, chrome} = versions
    result = result.concat([
      `Node: ${node} (ABI ${modules})`,
      `Electron ${electron}`,
      `Chrome ${chrome}`
    ])
    result.unshift(
      `Bay of Plenty ${versions['bay-of-plenty']}`
    )
    cb(null, postProc(result))
  })
}

function shorter(s) {
  return s.substr(0, 6)
}
document.addEventListener('mousedown', function (event) {
  if (event.detail > 1) {
      event.preventDefault();
  }
}, false)

styles(`
  *:focus {
    outline-color: rgba(0,255,0,0.2);
  }
  body {
    background-color: #333;
    color: #bbb;
    font-family: sans;
  }
  .bop-bootmenu ul {
    padding: 0;
    list-style: none;
  }
  .bop-bootmenu li {
    white-space: nowrap;
  }
  .bop-bootmenu ul.networks, .add-app {
    margin: auto;
    width: 40em;
  }
  .bop-bootmenu .netkey {
    font-family: monospace;
  }
  .bop-bootmenu ul.apps, .invite-entry {
    padding: 0;
    box-sizing: border-box;
    overflow-y: auto;
    margin: 1em 1em;
  }
  .bop-bootmenu ul.apps {
    border: 1px solid #222;
  }
  .invite-entry textarea {
    background: #555;
    border: 1px solid #222;
    color: #bbb;
    font-size: 16px;
    padding: .3em 0em;
    padding-left: 1em;
  }
  .bop-bootmenu ul.apps > li {
    background: #555;
    border-top: 1px solid #666;
    color: #bbb;
    font-size: 16px;
    padding: .3em 0em;
    padding-left: 1em;
  }
  .bop-bootmenu ul.apps > li > div {
    cursor: pointer;
  }
  .bop-bootmenu ul.apps > li:hover {
    background-color: darkgreen;
  }
  .bop-bootmenu ul.apps > li .name {
    font-size: 18px;
    text-shadow: 1px 1px 1px  rgba(0,0,0,.4);
    color: #ddd;
  }
  button {
    font-size: 16pt;
  }
`)

