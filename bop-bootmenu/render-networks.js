const styles = require('module-styles')('bop-bootmenu:render-networks')
const h = require('mutant/html-element')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')

const AvatarUpdate = require('./avatar-updates')

const SIZE = 96;

const bricons = require('bricons')
const svgSymbol = require('./svg-symbol')
const iconPlaceholder = svgSymbol(
  bricons.svg('ionicons/infinite')
)
/* flower card hammer grid */
/* medical infinite snow cog */
/*
function renderNetworkList(networks) {
  return h('ul.networks', MutantMap(networks, netkey => {
    return h('li', {
      classList: computed(selectedNetwork, sel => netkey == sel ? ['selected'] : []),
      'ev-click': ev =>{
        selectedNetwork.set(netkey)
      }
    }, netkey)
  }))
}
*/

module.exports = function(ssb) {
  const getAvatarUpdates = AvatarUpdate(ssb)

  return function renderNetworks(networks, selectedNetwork) {
    return h('ul.networks', MutantMap(networks, netkey=>{
      const avatar = getAvatarUpdates(netkey, feedIdFromNetworkId(netkey))
      return computed(avatar, avatar => {
        const thumbnailUrl = avatar && avatar.image && avatar.image[`${SIZE}x${SIZE}`]
        const name = avatar && avatar.name 
        const description = avatar && avatar.description 
        return h('li', {
          classList: computed(selectedNetwork, sel => netkey == sel ? ['selected'] : []),
          'ev-click': ev =>{
            selectedNetwork.set(netkey)
          }
        }, [ 
          h('.icon', {
            style: {
              width: `${SIZE}px`,
              height: `${SIZE}px`
            }
          }, [
            thumbnailUrl ?
            h('div', {
              style: {
                'background-image': `url(${thumbnailUrl})`
              }
            }) : iconPlaceholder()
          ]),
          h('.meta', [
            h('.name', name || 'no name set' ),
            h('.description', description || 'no description'),
          ]),
          h('.netkey', netkey)
        ])
      })
    }))
  }
}

function feedIdFromNetworkId(netkey) {
  const caps = netkey.slice(1).split('.')[0]
  return `@${caps}.ed25519`
}

styles(`
  .bop-bootmenu .sidebar ul.networks {
    padding: 0;
    margin: 0;
    list-style: none;
    width: 100%;
    font-size: 24pt;
  }
  .bop-bootmenu .sidebar ul.networks li {
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: ${SIZE}px minmax(0px,1fr);
    grid-template-rows: ${SIZE}px 1em;
    border-bottom: 1px solid #111;
    column-gap: 8px;
    row-gap: 5px;
  }
  .bop-bootmenu .sidebar ul.networks li.selected {
    background: #322E4C;
  }
  .bop-bootmenu ul.networks > li .icon {
    width: ${SIZE}px;
    height: ${SIZE}px;
    background: #555;
    fill: #333;
    grid-rows: 1/4;
    grid-columns: 1/2;
  }
  .bop-bootmenu ul.networks > li .icon > div {
    background-size: cover;
    width: 100%;
    height: 100%;
  }
  .bop-bootmenu ul.networks > li .meta {
    grid-row: 1/2;
    grid-column: 2/3;
    overflow: hidden;
  }
  .bop-bootmenu ul.networks > li .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bop-bootmenu ul.networks > li .description {
    opacity: 0.5;
    font-size: 20pt;
  }
  .bop-bootmenu ul.networks > li .netkey  {
    overflow: hidden;
    user-select: all;
    text-overflow: ellipsis;
    font-family: monospace;
    grid-row: 2/3;
    grid-column: 1/3;
    font-size: 16pt;
    opacity: 0.5;
  }
`)
