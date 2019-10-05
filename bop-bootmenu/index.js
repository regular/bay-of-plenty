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
    h('div.bop-bootmenu', [
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
        }, [ 
          h('div.name', webapp.value.content.name),
          h('div.description', webapp.value.content.description)
        ])
      })),
      makeInviteForm()
    ])
  )

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

styles(`
  body {
    background-color: #333;
    color: #bbb;
    font-family: sans;
  }
  .bop-bootmenu ul, .invite-entry {
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
  .bop-bootmenu li {
    background: #555;
    border-top: 1px solid #666;
    color: #bbb;
    font-size: 16px;
    padding: .3em 0em;
    padding-left: 1em;
  }
  .bop-bootmenu li:hover {
    background-color: darkgreen;
  }
  .bop-bootmenu li .name {
    font-size: 18px;
    text-shadow: 1px 1px 1px  rgba(0,0,0,.4);
    color: #ddd;
  }
`)

