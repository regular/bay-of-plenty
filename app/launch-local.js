const h = require('hyperscript')
const setStyles = require('module-styles')('bayofplenty')

styles()

function styles() {
  setStyles(`
    ul.versions {
      display: grid;
      grid-template-rows: repeat(5, 1fr);
      grid-template-columns: 1fr 1fr 1fr;
      grid-auto-flow: row;
    }
    body {
      height: 100%;
      overflow: hidden;
      background-color: #333;
      font-family: sans-serif;
    }
    body {
      display: grid;
      grid-template-rows: 1fr;
      grid-template-columns: 1fr;
      height: 100%;
    }
    .bayofplenty {
      grid-row: 1;
      grid-column: 1;
    }
  `)
}
