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

  document.body.appendChild(
    h('div.bop-bootmenu', [
      computed(networks, networks=>{
        return h('ul.networks', networks.map(netkey => {
          return h('li', [
            h('details', {open: true}, [
              h('summary.netkey', netkey),
              renderAppsOfNetwork(netkey)
            ])
          ]) 
        }))
      }),

      makeInviteForm(),
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
      h('h1', 'Please enter invite code'),
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
        button = h('input', {
          type: "submit",
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
        })
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
  let result = []
  if (config && config.bootMsgRevision) {
    result.push(`BOP Bootmenu ${shorter(config.bootMsgRevision || 'n/a')}`)
  }
  if (!ssb.bayofplenty) return cb(null, result.join(sep))
  ssb.bayofplenty.versions((err, versions)=>{
    if (err) return cb(err)
    const {node, modules, electron, chrome} = versions
    result = result.concat([
      `Node: ${node} (ABI ${modules})`,
      `Electron ${electron}`,
      `Chrome ${chrome}`
    ])
    result.unshift(
      `Bat of Plenty ${versions['bay-of-plenty']}`
    )
    cb(null, result.join(sep))
  })
}

function shorter(s) {
  return s.substr(0, 6)
}

styles(`
  body {
    background-color: #333;
    color: #bbb;
    font-family: sans;
  }
  .bop-bootmenu ul.apps, .invite-entry {
    padding: 0;
    box-sizing: border-box;
    overflow-y: auto;
    margin: 5em 20%;
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
  .bop-bootmenu ul.apps > li:hover {
    background-color: darkgreen;
  }
  .bop-bootmenu ul.apps > li .name {
    font-size: 18px;
    text-shadow: 1px 1px 1px  rgba(0,0,0,.4);
    color: #ddd;
  }
`)

