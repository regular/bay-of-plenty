const styles = require('module-styles')('bop-bootmenu-render-apps')
const h = require('mutant/html-element')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')

module.exports = function renderApps(entries, launchApp, appLoading) {
  return h('ul.apps', MutantMap(entries, e=>{
    const {webapp, invite} = e
    return h('li', {
      classList: computed(appLoading, loading =>{
        return invite == loading ? ['loading'] : (loading ? ['hide'] : [])
      }),
      'ev-click': ev=>{
        launchApp(invite)
      }
    }, [ 
      h('div.name', webapp.value.content.name),
      h('div.description', webapp.value.content.description)
    ])
  }))
}

styles(`
  .bop-bootmenu ul.apps {
    padding: 0;
    list-style: none;
    box-sizing: border-box;
    overflow-y: auto;
    margin: 1em 1em;
    border: 1px solid #222;
  }
  .bop-bootmenu ul.apps > li {
    background: #555;
    border-top: 1px solid #666;
    color: #bbb;
    font-size: 16px;
    padding: .3em 0em;
    padding-left: 1em;
  }
  .bop-bootmenu ul.apps > li > div {
    cursor: pointer;
  }
  .bop-bootmenu ul.apps > li:hover {
    background-color: darkgreen;
  }
  .bop-bootmenu ul.apps > li.loading,
  .bop-bootmenu ul.apps > li.loading:hover {
    background-color: darkblue;
  }
  .bop-bootmenu ul.apps > li.hide {
    opacity: 0.2;
  }
  .bop-bootmenu ul.apps > li .name {
    font-size: 18px;
    text-shadow: 1px 1px 1px  rgba(0,0,0,.4);
    color: #ddd;
  }
`)
