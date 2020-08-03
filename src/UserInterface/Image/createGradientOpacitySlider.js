import { reaction, action } from 'mobx'

import macro from 'vtk.js/Sources/macro'
import style from '../ItkVtkViewer.module.css'
import applyContrastSensitiveStyle from '../applyContrastSensitiveStyle'
import updateGradientOpacity from '../../Rendering/updateGradientOpacity'

import gradientOpacityIcon from '../icons/gradient.svg'

function createGradientOpacitySlider(store, uiContainer) {
  const sliderEntry = document.createElement('div')
  sliderEntry.setAttribute('class', style.sliderEntry)
  sliderEntry.innerHTML = `
    <div itk-vtk-tooltip itk-vtk-tooltip-top itk-vtk-tooltip-content="Gradient opacity" class="${style.gradientOpacitySlider}">
      ${gradientOpacityIcon}
    </div>
    <input type="range" min="0" max="1" value="0.2" step="0.01"
      id="${store.id}-gradientOpacitySlider"
      class="${style.slider}" />`
  const edgeElement = sliderEntry.querySelector(
    `#${store.id}-gradientOpacitySlider`
  )
  const sliderEntryDiv = sliderEntry.children[0]
  applyContrastSensitiveStyle(store, 'invertibleButton', sliderEntryDiv)

  reaction(
    () => {
      return store.imageUI.gradientOpacity
    },
    macro.throttle(
      () => {
        edgeElement.value = store.imageUI.gradientOpacity
        updateGradientOpacity(store)
      },
      20,
      false
    )
  )
  edgeElement.addEventListener(
    'input',
    action(event => {
      event.preventDefault()
      event.stopPropagation()
      store.imageUI.gradientOpacity = Number(edgeElement.value)
    })
  )
  uiContainer.appendChild(sliderEntry)
}

export default createGradientOpacitySlider
