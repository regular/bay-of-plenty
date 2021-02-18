const {join} = require('path')
const debug = require('debug')('bop:tabs:index')
const Tabs = require('./tabs')
const Tabbar = require('./tabbar')
const loadScript = require('../script-loader')

module.exports = async function initTabs(win, mainPage, opts) {
  const {makeView, initTabView, DEBUG_TABS} = opts

  await loadScript(mainPage, join(__dirname, 'tabbar-browser.js'), {
    keepIntercepting: true
  })

  const tabbar = Tabbar(mainPage)

  async function initNewTab(view, newTabOpts) {
    // keep tabbar in sync
    tabbar.onNewTab(view.id, `⌘${view.id} — loading`)
    view.on('activate-tab', ()=>{
      tabbar.onTabActivated(view.id)
    })
    view.on('close', ()=>{
      tabbar.onTabClosed(view.id)
    })
    await initTabView(view, newTabOpts)
  }

  const tabs = Tabs(win, makeView, initNewTab, {
    topMargin: 32,
    bottomMargin: DEBUG_TABS ? 250 : 0
  })

  tabbar.on('new-tab', e=>{
    tabs.newTab()
  })
  tabbar.on('previous-tab', e=>{
    tabs.previousTab()
  })
  tabbar.on('next-tab', e=>{
    tabs.nextTab()
  })
  tabbar.on('activate-tab', e=>{
    tabs.activateTab(e.id)
  })
  tabbar.on('close-tab', e=>{
    tabs.closeTab(e.id)
  })
  return Object.assign({}, tabs, {
    addTag: function(viewId, tag, value) {
      tabbar.onTabAddTag(viewId, tag, value)
    },
    removeTag: function(viewId, tag) {
      tabbar.onTabRemoveTag(viewId, tag)
    },
    setTitle: function(viewId, title) {
      tabbar.onTabTitleChanged(viewId, title)
    }
  })
}
