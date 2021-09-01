const {EventEmitter} = require('events')
const debug = require('debug')('bop:tab-class')

module.exports = function({
  makeView,
  manageLifetime,
  addView,
  removeAllViews
}) {
  let currId // currently visible tab
  let nextId = -1
  const tabById = {}

  class Tab extends EventEmitter {
    constructor(view) {
      super()
      this.view = view
      this.id = `${++nextId}`
    }
    activate() {
      const currTab = currentTab()
      if (this == currTab) return
      if (currTab) currTab.deactivate()
    
      currId = this.id
      showTab(this)
      this.emit('activate-tab')
    }
    deactivate() {
      if (this == currentTab()) {
        this.emit('deactivate-tab')
      }
    }
    close() {
      if (this == currentTab() && count() > 1) {
        nextTab()
      }
      this.destroy()
    }
    destroy() { 
      delete tabById[this.id]
      this.deactivate()
      this.emit('close', {last: count() == 0})
      this.removeAllListeners()
    }
  }

  function newTab(newTabOpts) {
    const view = makeView(newTabOpts)
    const tab = new Tab(view, newTabOpts)
    tabById[tab.id] = tab
    manageLifetime(view, tab, newTabOpts)
    tab.activate()
    return tab
  }

  function getTabById(id) {
    return tabById[id]
  }

  function count() {
    return Object.keys(tabById).length 
  }

  function gotoTab(offset) {
    const keys = Object.keys(tabById).sort()
    const newId = keys[(keys.indexOf(currId)+keys.length+offset) % keys.length]
    debug('gotoTab offset=%d, kyes=%o, curr=%d, new=%d', offset, keys, currId, newId)
    if (newId == currId || newId == undefined) return
    getTabById(newId).activate()
  }

  function previousTab() {
    gotoTab(-1)
  }

  function nextTab() {
    gotoTab(1)
  }

  function currentTab() {
    return getTabById(currId)
  }

  return {
    newTab,
    previousTab,
    nextTab,
    currentTab,
    getTabById
  }

  // -- util

  function showTab(tab) {
    debug(`showTab #${tab.id}`)
    removeAllViews()
    addView(tab.view)
  }

}

