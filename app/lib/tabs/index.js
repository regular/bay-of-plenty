const {join} = require('path')
const debug = require('debug')('bop:tabs:index')
const Tabs = require('./tabs')
const Tabbar = require('./tabbar')
const loadScript = require('../script-loader')

module.exports = async function initTabs(win, mainPage, opts) {
  const {makeView, initTabView, setWindowTitle, DEBUG_TABS} = opts
  const tabTitles = {}
  let activeTab = -1

  await loadScript(mainPage, join(__dirname, 'tabbar-browser.js'), {
    keepIntercepting: true
  })

  const tabbar = Tabbar(mainPage)

  async function initNewTab(view, newTabOpts) {
    // keep tabbar in sync
    activeTab = view.id
    tabbar.onNewTab(view.id, `⌘${view.id} — loading`)
    view.on('activate-tab', ()=>{
      activeTab = view.id
      const title = tabTitles[view.id]
      setWindowTitle(title)
      console.log('XXX activeTab %d "%s"', activeTab, title)
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
    setTabTitle: function(viewId, title) {
      tabTitles[viewId] = title
      console.log('XXX setTabTitle of tab %d (%d is active): "%s"', viewId, activeTab, title)
      if (viewId == activeTab) {
        setWindowTitle(title)
      }
      tabbar.onTabTitleChanged(viewId, makeString(title))
    }
  })
}

function makeString(o) {
  if (typeof o == 'string') return o
  return o.title
}
