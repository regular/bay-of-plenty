const h = require('mutant/html-element')
const setStyles = require('module-styles')('bop-tabbar')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')

const bricons = require('bricons')
const Icon = require('./lib/svg-symbol')
const closeCircle = Icon(bricons.svg('ionicons/close-circle'))
const chevronForward = Icon(bricons.svg('ionicons/chevron-forward'))
const chevronBack = Icon(bricons.svg('ionicons/chevron-back'))
const add = Icon(bricons.svg('ionicons/add'))

styles()

const tabs = MutantArray()
const active = Value()

document.body.appendChild(
  h('.topbar', [
    h('.tabbar',MutantMap(tabs, renderTab)),
    h('.button.prev-tab', {
      'ev-click': e=>send('previous-tab')
    }, chevronBack({title: 'previous tab'})),
    h('.button.next-tab', {
      'ev-click': e=>send('next-tab')
    }, chevronForward({title: 'next tab'})),
    h('.button.add-tab', {
      'ev-click': e=>send('new-tab')
    }, add({title: 'open new tab'}))
  ])
)

function renderTab(tab) {
  return h('.tab', {
    classList: computed([tab, active], (tab, active)=>{
      return tab.id == active ? ['active'] : []
    }),
    'ev-click': e=>send('activate-tab', {id:tab.id})
  }, [
    h('.title', computed(tab, tab => tab.title)),
    h('.close', {
      'ev-click': e=> send('close-tab', {id:tab.id})
    }, closeCircle({title: 'close tab'}))
  ])
}

async function send(name, data) {
  data = data || {}
  const response = await fetch(`/${name}`, {
    method: 'POST',
    mode: 'same-origin',
    cache: 'no-cache',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json'
    },
    redirect: 'error',
    referrerPolicy: 'same-origin',
    body: JSON.stringify(data)
  })
  return response.json()
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
      user-select: none;
      height: 100%;
      overflow: hidden;
      font-family: sans-serif;
    }
    .topbar {
      height: 32px;
      border-bottom: 1px solid #222;
      background: #111;
      display: grid;
      place-content: start;
      grid-template-columns: auto 16px 16px 32px;
    }
    .tab, .button {
      cursor: pointer;
    }
    .topbar .button {
      height: 31px;
      padding-top: 3px;
      text-align: center;
      font-size: 20px;
      background: #111;
      stroke: #333;
      place-self: stretch;
    }
    .topbar .button:hover {
      stroke: #aaa;
    }
    .tabbar, .tab {
      height: 29px;
    }
    .tabbar {
      max-width: calc(100vw - 64px);
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
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
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
      width: 18px;
      height: 18px;
      fill: #666;
      place-self: center;
    }
    .tab > .close:hover {
      fill: #e77;
    }
    .tab:not(.active):hover .title {
      color: #888;
    }
    .tab.active {
      color: #aaa;
      background: #333;
      border-color: #666;
    }
  `)
}
