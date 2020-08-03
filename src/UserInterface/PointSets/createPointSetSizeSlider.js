import { reaction } from 'mobx'

import style from '../ItkVtkViewer.module.css'
import applyContrastSensitiveStyle from '../applyContrastSensitiveStyle'

import pointSetSizeIcon from '../icons/point-set-size.svg'

function createPointSetSizeSlider(store, pointSetSizeRow) {
  const defaultPointSetSize = 3

  const sliderEntry = document.createElement('div')
  sliderEntry.setAttribute('class', style.sliderEntry)
  sliderEntry.innerHTML = `
    <div itk-vtk-tooltip itk-vtk-tooltip-bottom itk-vtk-tooltip-content="Size" class="${style.gradientOpacitySlider}">
      ${pointSetSizeIcon}
    </div>
    <input type="range" min="1" max="20" value="${defaultPointSetSize}" step="1"
      id="${store.id}-pointSetSizeSlider"
      class="${style.slider}" />`
  const sizeElement = sliderEntry.querySelector(
    `#${store.id}-pointSetSizeSlider`
  )
  const sliderEntryDiv = sliderEntry.children[0]
  applyContrastSensitiveStyle(store, 'invertibleButton', sliderEntryDiv)

  reaction(
    () => {
      return store.pointSetsUI.pointSets.slice()
    },
    pointSets => {
      if (!!!pointSets || pointSets.length === 0) {
        return
      }

      pointSets.forEach((pointSet, index) => {
        if (store.pointSetsUI.sizes.length <= index) {
          store.pointSetsUI.sizes.push(defaultPointSetSize)
        }
      })
      const selectedPointSetIndex = store.pointSetsUI.selectedPointSetIndex
      sizeElement.value = store.pointSetsUI.sizes[selectedPointSetIndex]
    }
  )

  reaction(
    () => {
      return store.pointSetsUI.selectedPointSetIndex
    },
    selectedPointSetIndex => {
      sizeElement.value = store.pointSetsUI.sizes[selectedPointSetIndex]
    }
  )

  reaction(
    () => {
      return store.pointSetsUI.sizes.slice()
    },
    sizes => {
      for (let index = 0; index < sizes.length; index++) {
        store.pointSetsUI.representationProxies[index].setPointSize(
          sizes[index]
        )
      }
      store.renderWindow.render()
      sizeElement.value = sizes[store.pointSetsUI.selectedPointSetIndex]
    }
  )

  sizeElement.addEventListener('input', event => {
    event.preventDefault()
    event.stopPropagation()
    const selectedPointSetIndex = store.pointSetsUI.selectedPointSetIndex
    store.pointSetsUI.sizes[selectedPointSetIndex] = Number(event.target.value)
  })

  const defaultPointSetSizes = new Array(store.pointSetsUI.pointSets.length)
  defaultPointSetSizes.fill(defaultPointSetSize)
  sizeElement.value = defaultPointSetSize
  store.pointSetsUI.sizes = defaultPointSetSizes
  store.pointSetsUI.representationProxies.forEach(proxy => {
    proxy.setPointSize(defaultPointSetSize)
  })

  pointSetSizeRow.appendChild(sliderEntry)
}

export default createPointSetSizeSlider
