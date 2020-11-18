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
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')

const getVersions = require('./get-versions')

preventDblClickSelection()

const versions = Value()
const entries = MutantArray()
const appLoading = Value()
const selectedNetwork = Value()

loadEntries(entries)

entries(entries => {
  localStorage.entries = JSON.stringify(entries)
})

const networks = networksFromEntries(entries)

client( (err, ssb, config) =>{
  if (err) return console.error(err)
  const renderIdentities = IdentitySelector(ssb)

  let main, sidebar
  document.body.appendChild(h('.bop-bootmenu', [
    makeSplitPane({horiz: true}, [
      makePane('33%',
        sidebar = h('.sidebar', [
          renderNetworkList(networks),
          renderAddApp()
        ])
      ),
      makeDivider(),
      makePane('',
        main = h('.main')
      )
    ]),
    h('.versions', versions)
  ]))

  getVersions(ssb, config, (err, v) =>{
    if (err) console.error(err.message)
    versions.set(v)
  })

  main.appendChild(
    h('.scroll-view', [
      renderMenu()
    ])
  )

  setTimeout( ()=>{
    document.body.classList.add('show')
  }, 100)

  function renderMenu() {
    return computed([networks, selectedNetwork], (networks, netkey) =>{
      if (!netkey) return []
      return h('.menu', [
        renderIdentities(netkey),
        renderAppsOfNetwork(netkey)
      ])
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
          h('span', 'Enter Invite Codee')
        ]),
        makeInviteForm()
      ])
    ])
  }

  function launchApp(invite) {
    if (appLoading()) return
    document.body.classList.add('loading')
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

function renderNetworkList(networks) {
  return h('ul.networks', MutantMap(networks, netkey => {
    return h('li', {
      classList: computed(selectedNetwork, sel => netkey == sel ? ['selected'] : []),
      'ev-click': ev =>{
        selectedNetwork.set(netkey)
      }
    }, netkey)
  }))
}

function preventDblClickSelection() {
  document.addEventListener('mousedown', function (event) {
    if (event.detail > 1) {
        event.preventDefault()
    }
  }, false)
}

function networksFromEntries(entries) {
  return computed(entries, entries => {
    return Object.keys(entries.reduce((acc, {invite})=>{
      const parsed = parse(invite)
      if (parsed) acc[parsed.network] = true
      return acc
    }, {})).sort()
  })
}

function loadEntries(entries) {
  let _entries = []
  try {
    _entries = JSON.parse(localStorage.entries)
    entries.set(_entries || [])
  } catch(e) {}
}


styles(`
  .horizontal-split-pane {
    overflow: hidden;
  }
  html * {
    box-sizing: border-box;
  }
  ::-webkit-scrollbar {                                                                                         
    width: 0px !important;
  }
  *:focus {
    outline-color: rgb(50,70,70);
  }
  html, body {
    padding: 0;
    margin: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
  body {
    opacity: 0;
    //background-color: #202020;
    background-color: #1f2029;
    color: #bbb;
    font-family: sans-serif;
  }
  body.show {
    opacity: 1;
    transition-property: opacity;
    transition-duration: 1s;
  }
  .bop-bootmenu {
    display: grid;
    grid-auto-flow: row;
    grid-template-rows: minmax(0,1fr) 2em;
    place-items: stretch;
    padding: 0;
    margin: 0;
    height: 100%;
    width: 100%;
  }
  .bop-bootmenu .versions {
    //background: #222;
    background-color: #1e1e23;
    color: #666;
    margin: 0;
    padding: .4em;
  }
  .bop-bootmenu .sidebar {
    //background: #303030;
    background-color: #22222d;
    height:  100%;
    width: 100%;
    overflow: hidden;
  }
  .loading .sidebar,
  .loading .identities-container {
    opacity: 0;
    transition-property: opacity;
    transition-duration: 1s;
    transition-delay: .5s;
  }
  .bop-bootmenu .sidebar ul.networks {
    padding: 0;
    list-style: none;
    width: 100%;
    font-size: 24pt;
  }
  .bop-bootmenu .sidebar ul.networks li {
    width: calc(100% - 20px);
    overflow: hidden;
    user-select: all;
    text-overflow: ellipsis;
    font-family: monospace;
  }
  .bop-bootmenu .sidebar ul.networks li.selected {
    background: green;
  }
  .bop-bootmenu .main {
    overflow-x: visible;
    overflow-y: auto;
    padding: 0;
    margin: 0;
    height: 100%;
  }
  @keyframes fadein {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .bop-bootmenu .menu {
    animation-name: fadein;
    animation-duration: 1s;
    width: 80%;
    margin: auto;
  }
  .bop-bootmenu h1 {
    margin: 1em 0em;
  }
  .bop-bootmenu li {
    //white-space: nowrap;
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
    width: calc(100% - 2em);
  }
  .invite-entry textarea {
    background: #555;
    border: 1px solid #222;
    color: #bbb;
    font-size: 16px;
    padding: .3em 0em;
    padding-left: 1em;
    width: 100%;
  }
  button {
    font-size: 16pt;
  }
`)

