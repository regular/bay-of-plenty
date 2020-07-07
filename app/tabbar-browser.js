const h = require('mutant/html-element')
const setStyles = require('module-styles')('bop-tabbar')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')

styles()

const tabs = MutantArray()
const active = Value()

document.body.appendChild(
  h('.tabbar',MutantMap(tabs, renderTab))
)

function renderTab(tab) {
  return h('.tab', {
    classList: computed([tab, active], (tab, active)=>{
      return tab.id == active ? ['active'] : []
    })
  }, [
    h('.title', computed(tab, tab => tab.title)),
    h('.close', 'x')
  ])
}

window.addEventListener('on-new-tab', e=>{
  const {id, title} = e.detail
  tabs.push({title, id})
  active.set(id)
})

window.addEventListener('on-tab-closed', e=>{
  const {id} = e.detail
  const x = tabs.find( x=>x.id==id )
  if (x !== undefined) tabs.delete(x)
  else console.error('close: tab not found', id)
})

window.addEventListener('on-tab-activated', e=>{
  const {id} = e.detail
  active.set(id)
})

window.addEventListener('on-tab-title-changed', e=>{
  const {id, title} = e.detail
  const x = tabs.find( x=>x.id==id )
  if (x === undefined) return console.error('on tab tilte changed: tab not found', id)
  const i = tabs.indexOf(x)
  tabs.put(i, {id, title})
})

function styles() {
  setStyles(`
    html {
      height: 100%;
    }
    html * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      height: 100%;
      overflow: hidden;
      font-family: sans-serif;
    }
    .tabbar, .tab {
      height: 32px;
    }
    .tabbar {
      background-color: #111;
      display: grid;
      column-gap: 3px;
      padding: 2px 2px;
      grid-auto-columns: minmax(60px,max-content);
      grid-auto-flow: column;
    }
    .tab {
      display: grid;
      column-gap: 2px;
      place-self: stretch;
      grid-template-columns: 1fr 32px;
      color: #555;
      background: #222;
      border: 1px solid #444;
      border-bottom: none;
      border-radius: 4px;
      max-width: 200px;
      align-items: center;
    }
    .tab > .title {
      padding-left: 6px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .tab > .close {
      place-self: center;
    }
    .tab.active {
      color: #bbb;
      background: #333;
      border-color: #666;
    }
  `)
}
