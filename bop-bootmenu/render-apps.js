const styles = require('module-styles')('bop-bootmenu-render-apps')
const h = require('mutant/html-element')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')

const AvatarUpdate = require('./avatar-updates')

const SIZE = 96;

const bricons = require('bricons')
const svgSymbol = require('./svg-symbol')
const iconPlaceholder = svgSymbol(
  bricons.svg('ionicons/flower')
)
/* flower card hammer grid */

module.exports = function(ssb) {
  const getAvatarUpdates = AvatarUpdate(ssb)

  return function renderApps(netkey, entries, launchApp, appLoading) {
    return h('ul.apps', MutantMap(entries, e=>{
      const {webapp, invite} = e
      const {repositoryBranch} = webapp.value.content
      const revRoot = revisionRoot(webapp)
      const avatar = getAvatarUpdates(netkey, revRoot)
      return computed(avatar, avatar => {
        const thumbnailUrl = avatar && avatar.image && avatar.image[`${SIZE}x${SIZE}`]
        const name = avatar && avatar.name 
        const description = avatar && avatar.description 

        return h('li', {
          'data-id': revRoot,
          title: formatDesciption(webapp, description),
          classList: computed(appLoading, loading =>{
            return invite == loading ? ['loading'] : (loading ? ['hide'] : [])
          }),
          'ev-click': ev=>{
            launchApp(invite)
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
            }) : iconPlaceholder(),
            repositoryBranch !== 'master' ?  h('.branch', repositoryBranch) : []
          ]),
          h('.name', formatName(webapp, name))
        ])
      })
    }))
  }
}

function formatName(webapp, override) {
  let {name} = webapp.value.content
  name = name.replace(/\s\[[^\]]+\]/,'') 
  return override || name
}

function formatDesciption(webapp, override) {
  let {description} = webapp.value.content
  return override || description
}

styles(`
  .bop-bootmenu ul.apps * {
    box-sizing: border-box;
  }
  .bop-bootmenu ul.apps {
    margin-top: 4em;
    padding: 0;
    list-style: none;
    box-sizing: border-box;
    overflow: visible;
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
    position: relative;
    width: ${SIZE}px;
    height: ${SIZE}px;
    border-radius: 20%;
    background: #555;
    border: 4px solid #222;
    margin: auto;
    margin-bottom: 5px;
    fill: #333;
    overflow: hidden;
  }
  .bop-bootmenu ul.apps > li .icon > div {
    background-size: cover;
    width: 100%;
    height: 100%;
  }
  .bop-bootmenu ul.apps > li .icon:after {
    content: '';
    opacity: 0.7;
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: -webkit-linear-gradient(top, rgba(255,255,255,0.7) 0%,rgba(255,255,255,0.1) 100%);
    width: 100%;
    height: 60%;
    box-shadow: inset 0px 2px 1px rgba(255, 255, 255, 0.7);
    border-top-right-radius: 20%;
    border-top-left-radius: 20%;
    border-bottom-right-radius: 50% 20px;
    border-bottom-left-radius: 50% 20px;
  }
  .bop-bootmenu ul.apps > li:hover .icon,
  .bop-bootmenu ul.apps > li.loading .icon {
    border-color: #888;
  }
  .bop-bootmenu ul.apps > li.loading .icon {
    z-index: 1;
    transform-origin: 50% 50%;
    transform: scale(2.5);
    opacity: 0;
    transition-property: opacity transform;
    transition-duration: .75s;
    position: relative;
  }
  .bop-bootmenu ul.apps > li .icon .branch {
    width: 100%;
    height: 25%;
    background: yellow;
    position: absolute;
    bottom: 0px;
    text-align: center;
    color: black;
    opacity: 0.4;
    transform-origin: 50% -100%;
    //transform: rotate(-45deg);
    text-transform: uppercase;
    font-size: 13px;
    font-weight: bolder;
    padding-top: 5px;
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

function revisionRoot(kv) {
  return kv.value.content.revisionRoot || kv.key
}

