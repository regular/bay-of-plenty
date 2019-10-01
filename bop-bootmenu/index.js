const {client} = require('tre-client')
const styles = require('module-styles')('bop-bootmenu')
const h = require('mutant/html-element')
const debug = require('debug')('bop-bootmenu')


client( (err, ssb, config) =>{
  console.dir(config)
  document.body.appendChild(makeInviteForm(ssb))
})

styles(`
  body {
    background-color: #444;
    color: #ddd;
  }
`)

function makeInviteForm(ssb) {
  let textarea

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
        placeholder: "Your invite code goes here"
      }),
      h('input', {
        type: "submit",
        'ev-click': ev=>{
          setTimeout( ()=>{
            ev.target.disabled = true
          }, 1)
          const code = textarea.value
          console.log('invite code', code)
          ev.preventDefault()
          ssb.bayofplenty.openApp(code, err=>{
            console.error(`openApp failed: ${err.message}`)
            ev.target.disabled = false
          })
        }
      })
    ])
  ])
}
