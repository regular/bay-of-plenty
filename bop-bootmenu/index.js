const {client} = require('tre-client')
const styles = require('module-styles')('bop-bootmenu')
const h = require('mutant/html-element')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const debug = require('debug')('bop-bootmenu')
const pull = require('pull-stream')
const {parse} = require('tre-invite-code')
const IdentitySelector = require('./identity-selector')
const renderApps = require('./render-apps')

client( (err, ssb, config) =>{
  if (err) return console.error(err)
  const renderIdentities = IdentitySelector(ssb)

  const versions = Value()
  getVersions(ssb, config, (err, v) =>{
    versions.set(v)
  })

  const entries = MutantArray()
  loadEntries(entries)
  const appLoading = Value()

  entries(entries => {
    localStorage.entries = JSON.stringify(entries)
  })

  const networks = computed(entries, entries => {
    return Object.keys(entries.reduce((acc, {invite})=>{
      const parsed = parse(invite)
      if (parsed) acc[parsed.network] = true
      return acc
    }, {})).sort()
  })

  // prevent selection on dblclick
  document.addEventListener('mousedown', function (event) {
    if (event.detail > 1) {
        event.preventDefault()
    }
  }, false)


  document.body.appendChild(
    h('.bop-bootmenu', [
      h('.main', [
        //h('h1', 'Bay of Plenty'),
        h('.scroll-view', [
          renderMenu(),
          renderAddApp()
        ])
      ]),
      h('.versions', versions)
    ])
  )
  setTimeout( ()=>{
    document.body.classList.add('show')
  }, 100)

  function renderMenu() {
    return computed(networks, networks=>{
      return [
        h('h1', networks.length == 0 ?
          'Please enter invite code' :
          ''
        ),
        h('ul.networks', networks.map(netkey => {
          return h('li', [
            h('details', {open: true}, [
              h('summary', [
                h('span', 'Network: '),
                h('span.netkey', netkey)
              ]),
              renderIdentities(netkey),
              renderAppsOfNetwork(netkey)
            ])
          ]) 
        }))
      ]
    })
  }

  function renderAddApp() {
    return h('.add-app', [
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
    ])
  }

  function launchApp(invite) {
    if (appLoading()) return
    const parsed = parse(invite)
    if (!parsed) throw Error('invalid invite')
    appLoading.set(invite)
    const netkey = parsed.network 
    const id = localStorage[`id-${netkey}`]
    ssb.bayofplenty.openApp(invite, id, (err, result)=>{
      if (err) {
        appLoading.set(null)
        console.error(err.message)
        return
      }
      const {url} = result
      document.location.href = url
    })
  }

  function renderAppsOfNetwork(netkey) {
    const my_entries = computed(entries, entries=>{
      return entries.filter(e=>{
        const {webapp, invite} = e
        const parsed = parse(invite)
        if (!parsed) return false
        return parsed.network == netkey
      })
    })
    return renderApps(my_entries, launchApp, appLoading)
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
              if (appLoading()) return
              appLoading.set(code)
              ev.preventDefault()
              const parsed = parse(code)
              if (!parsed) throw new Error('invite parse error')
              ssb.bayofplenty.addIdentity(parsed.network, (err, id) => {
                if (err) return console.error(err.message)
                ssb.bayofplenty.openApp(code, id, (err, result)=>{
                  if (err) {
                    appLoading.set(null)
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

styles(`
  ::-webkit-scrollbar {                                                                                         
    width: 0px !important;
  }
  *:focus {
    outline-color: rgb(50,70,70);
  }
  body {
    opacity: 0;
    background-color: #333;
    color: #bbb;
    font-family: sans-serif;
  }
  body.show {
    opacity: 1;
    transition-property: opacity;
    transition-duration: 1s;
  }
  html, body {
    padding: 0;
    margin: 0;
    height: 100%;
  }
  .bop-bootmenu {
    display: grid;
    grid-auto-flow: row;
    grid-template-rows: 1fr 2em;
    place-items: stretch;
    padding: 0;
    margin: 0;
    height: 100%;
  }
  .bop-bootmenu .versions {
    background: #222;
    color: #666;
    margin: 0;
    padding: .4em;
  }
  .bop-bootmenu .main {
    overflow-x: hidden;
    overflow-y: auto;
    height: 100%;
    padding: 0;
    margin: 0;
    height: 100%;
    justify-self: center;
  }
  .bop-bootmenu h1 {
    margin: 1em 0em;
  }
  .bop-bootmenu ul.networks {
    padding: 0;
    list-style: none;
  }
  .bop-bootmenu li {
    white-space: nowrap;
  }
  .bop-bootmenu ul.networks, .add-app {
    width: 40em;
  }
  .bop-bootmenu ul.apps {
    margin-top: 2em;
  }
  .bop-bootmenu .netkey, .feedid {
    font-family: monospace;
  }
  .bop-bootmenu .invite-entry {
    padding: 0;
    box-sizing: border-box;
    overflow-y: auto;
    margin: 1em 1em;
  }
  .invite-entry textarea {
    background: #555;
    border: 1px solid #222;
    color: #bbb;
    font-size: 16px;
    padding: .3em 0em;
    padding-left: 1em;
  }
  button {
    font-size: 16pt;
  }
`)

