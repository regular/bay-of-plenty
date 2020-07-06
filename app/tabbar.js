const h = require('mutant/html-element')
const setStyles = require('module-styles')('bop-tabbar')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')

styles()

const tabs = MutantArray()
tabs.push({name: 'foo', id: 1})

document.body.appendChild(
  h('.tabbar',MutantMap(tabs, renderTab))
)

function renderTab(tab) {
  return h('.tab', computed(tab, tab => tab.name))
}

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
    }
    .tab {
      display: inline-block;
      color: #888;
      border: 1px solid #666;
    }
  `)
}
