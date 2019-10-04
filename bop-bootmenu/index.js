const {client} = require('tre-client')
const styles = require('module-styles')('bop-bootmenu')
const h = require('mutant/html-element')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const debug = require('debug')('bop-bootmenu')
const {parse} = require('tre-invite-code')

client( (err, ssb, config) =>{
  if (err) return console.error(err)
  const entries = MutantArray()
  loadEntries(entries)

  entries(entries => {
    localStorage.entries = JSON.stringify(entries)
  })

  document.body.appendChild(
    h('div', [
      h('ul', MutantMap(entries, e=>{
        const {webapp, invite} = e
        return h('li', {
          'ev-click': ev=>{
            ssb.bayofplenty.openApp(invite, (err, result)=>{
              if (err) return
              const {url} = result
              document.location.href = url
            })
          }
        }, webapp.value.content.name)
      })),
      makeInviteForm()
    ])
  )

  function makeInviteForm() {
    let textarea, button

    return h('div', [
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

styles(`
  body {
    background-color: #444;
    color: #ddd;
  }
`)

