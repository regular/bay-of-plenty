const styles = require('module-styles')('bop-bootmenu-render-apps')
const h = require('mutant/html-element')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')

const SIZE = 96;

const bricons = require('bricons')
const svgSymbol = require('./svg-symbol')
const iconPlaceholder = svgSymbol(
  bricons.svg('ionicons/flower')
)
/*
flower
card
hammer
grid
*/

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
      h('.icon', [
        iconPlaceholder()
      ]),
      h('.name', webapp.value.content.name),
      h('.description', webapp.value.content.description)
    ])
  }))
}

styles(`
  .bop-bootmenu ul.apps * {
    box-sizing: border-box;
  }
  .bop-bootmenu ul.apps {
    padding: 0;
    list-style: none;
    box-sizing: border-box;
    overflow-y: auto;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: ${SIZE*1.2}px;
    grid-auto-rows: ${SIZE*1.75}px;
  }
  .bop-bootmenu ul.apps > li {
    color: #888;
    font-size: 16px;
    padding: 0;
    opacity: .7;
  }
  .bop-bootmenu ul.apps > li:hover {
    opacity: 1;
  }
  .bop-bootmenu ul.apps > li > div {
    cursor: pointer;
  }
  .bop-bootmenu ul.apps > li.hide {
    opacity: 0.2;
  }
  .bop-bootmenu ul.apps > li .icon {
    width: ${SIZE}px;
    height: ${SIZE}px;
    border-radius: 20%;
    background: #555;
    border: 4px solid #222;
    margin: auto;
    margin-bottom: 5px;
    fill: #333;
  }
  .bop-bootmenu ul.apps > li:hover .icon,
  .bop-bootmenu ul.apps > li.loading .icon {
    border-color: #888;
  }
  .bop-bootmenu ul.apps > li .name,
  .bop-bootmenu ul.apps > li .description {
    white-space: break-spaces;
    text-align: center;
  }
  .bop-bootmenu ul.apps > li .name {
    font-size: 18px;
    text-shadow: 1px 1px 1px  rgba(0,0,0,.4);
  }
`)
