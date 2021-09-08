const {join} = require('path')
const debug = require('debug')('bop:tabs:index')
const Tabs = require('./tab-class')
const Driver = require('./driver')
const Tabbar = require('./tabbar')
const loadScript = require('../script-loader')

module.exports = async function initTabs(win, mainPage, opts) {
  const {makeView, initTab, setWindowTitle, DEBUG_TABS} = opts
  const tabTitles = {}
  let activeTab = -1

  await loadScript(mainPage, join(__dirname, 'tabbar-browser.js'), {
    keepIntercepting: true
  })

  const tabbar = Tabbar(mainPage)

  async function initNewTab(tab, newTabOpts) {
    // keep tabbar in sync
    activeTab = tab.id
    tabbar.onNewTab(tab.id, `⌘${tab.id} — loading`)
    tab.on('activate-tab', ()=>{
      activeTab = tab.id
      const title = tabTitles[tab.id]
      debug('on activate-tab %d, setting window title to "%s"', activeTab, title)
      setWindowTitle(title)
      tabbar.onTabActivated(tab.id)
    })
    tab.on('close', ()=>{
      tabbar.onTabClosed(tab.id)
    })
    await initTab(tab, newTabOpts)
  }

  const driver = Driver( win, makeView, initNewTab, {
    topMargin: 32,
    bottomMargin: DEBUG_TABS ? 250 : 0
  })
  const tabs = Tabs(driver)

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
    const tab = tabs.getTabById(e.id)
    if (tab) tab.activate()
  })
  tabbar.on('close-tab', e=>{
    const tab = (e.id !== undefined && tabs.getTabById(e.id)) || tabs.currentTab()
    if (tab) tab.close()
  })
  return Object.assign({}, tabs, {
    addTag: function(viewId, tag, value) {
      tabbar.onTabAddTag(viewId, tag, value)
    },
    removeTag: function(viewId, tag) {
      tabbar.onTabRemoveTag(viewId, tag)
    },
    getTabByViewId: function(id) {
      return viewById[id]
    },
    setTabTitle: function(viewId, title) {
      tabTitles[viewId] = title
      debug('setTabTitle called for tab %d (%d is active): "%s"', viewId, activeTab, title)
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
