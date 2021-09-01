const Tabs = require('./tab-class')
const test = require('tape')

const view = {bar:'baz'}
const {newTab} = Tabs({
  makeView: ()=>view,
  manageLifetime: ()=>{}
})

test('id counts up', t=>{
  const tab1 = newTab()
  const tab2 = newTab()
  t.equals(tab1.id, 0)
  t.equals(tab2.id, 1)
  t.end()
})

test('Can emit events', t=>{
  const tab = newTab()
  tab.once('hello', ()=>t.end())
  tab.emit('hello')
})

test('has view', t=>{
  const tab = newTab()
  t.equals(tab.view, view)
  t.end()
})

test('activating a view', t=>{
  const view1 = {}
  const view2 = {}
  const views = [view1, view2]
  let n = 0

  t. plan(11)

  const {newTab} = Tabs({
    makeView: ()=>views.shift(),
    manageLifetime: ()=>{},
    removeAllViews: () => {
      t.pass('called remove all views')
    },
    addView: (view) => {
      t.pass('called addView')
      if (n==0) t.equals(view, view1)
      if (n==1) t.equals(view, view2)
    }
  })
  const tab1 = newTab()
  const tab2 = newTab()
  t.equals(tab1.view, view1)
  t.equals(tab2.view, view2)
  tab1.on('activate-tab', ()=>{
    t.pass('tab 1 emits activate-tab')
  })
  tab1.activate()
  n++
  tab1.on('deactivate-tab', ()=>{
    t.pass('tab 1 emits deactivate-tab')
  })
  tab2.on('activate-tab', ()=>{
    t.pass('tab 2 emits activate-tab')
  })
  tab2.activate()
})

