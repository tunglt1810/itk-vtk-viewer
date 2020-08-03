import { reaction } from 'mobx'

import style from './ItkVtkViewer.module.css'

import createColorRangeInput from './Image/createColorRangeInput'
import createBlendModeSelector from './Image/createBlendModeSelector'
import createComponentSelector from './Image/createComponentSelector'
import createTransferFunctionWidget from './Image/createTransferFunctionWidget'
import createViewPlanesToggle from './Image/createViewPlanesToggle'
import createUseShadowToggle from './Image/createUseShadowToggle'
import createSampleDistanceSlider from './Image/createSampleDistanceSlider'
import createGradientOpacitySlider from './Image/createGradientOpacitySlider'
import createDistanceButton from './Image/createDistanceButton'

function createImageUI(store, use2D) {
  const viewerDOMId = store.id

  const imageUIGroup = document.createElement('div')
  store.imageUI.imageUIGroup = imageUIGroup
  imageUIGroup.setAttribute('class', style.uiGroup)

  const componentSelector = createComponentSelector(store, imageUIGroup)

  const haveImage = !!store.imageUI.image

  if (haveImage) {
    const dataArray = store.imageUI.image.getPointData().getScalars()
    const components = store.imageUI.numberOfComponents

    // If not a 2D RGB image
    if (
      !(
        use2D &&
        dataArray.getDataType() === 'Uint8Array' &&
        (components === 3 || components === 4)
      )
    ) {
      const colorRangeInputRow = document.createElement('div')
      colorRangeInputRow.setAttribute('class', style.uiRow)
      // This row needs background different from normal uiRows, to aid
      // in the illusion that it's the content portion of a tabbed pane
      colorRangeInputRow.setAttribute(
        'style',
        'background: rgba(127, 127, 127, 0.5);'
      )
      createColorRangeInput(store, colorRangeInputRow)
      colorRangeInputRow.className += ` ${viewerDOMId}-toggle`
      imageUIGroup.appendChild(colorRangeInputRow)
    }

    createTransferFunctionWidget(store, imageUIGroup, use2D)

    // Put distance tools in their own row
    const distanceRulerRow = document.createElement('div')
    distanceRulerRow.setAttribute('class', style.uiRow)
    distanceRulerRow.className += ` ${viewerDOMId}-distanceRuler ${viewerDOMId}-toggle`
    distanceRulerRow.style.display = use2D ? 'flex' : 'none'

    createDistanceButton(store, distanceRulerRow)

    imageUIGroup.appendChild(distanceRulerRow)

    reaction(
      () => {
        return store.mainUI.viewMode
      },
      viewMode => {
        switch (viewMode) {
          case 'XPlane':
          case 'YPlane':
          case 'ZPlane':
            distanceRulerRow.style.display = 'flex'
            break
          case 'VolumeRendering':
            distanceRulerRow.style.display = 'none'
            break
          default:
            console.error('Invalid view mode: ' + viewMode)
        }
      }
    )
  }

  if (!use2D && haveImage) {
    const volumeRenderingRow1 = document.createElement('div')
    volumeRenderingRow1.setAttribute('class', style.uiRow)
    volumeRenderingRow1.className += ` ${viewerDOMId}-volumeRendering1 ${viewerDOMId}-toggle`
    createUseShadowToggle(store, volumeRenderingRow1)
    createGradientOpacitySlider(store, volumeRenderingRow1)
    imageUIGroup.appendChild(volumeRenderingRow1)

    const volumeRenderingRow2 = document.createElement('div')
    volumeRenderingRow2.setAttribute('class', style.uiRow)
    volumeRenderingRow2.className += ` ${viewerDOMId}-volumeRendering2 ${viewerDOMId}-toggle`
    createViewPlanesToggle(store, imageUIGroup, volumeRenderingRow2)
    createSampleDistanceSlider(store, volumeRenderingRow2)
    createBlendModeSelector(store, volumeRenderingRow2)
    imageUIGroup.appendChild(volumeRenderingRow2)

    reaction(
      () => {
        return store.mainUI.viewMode
      },
      viewMode => {
        switch (viewMode) {
          case 'XPlane':
          case 'YPlane':
          case 'ZPlane':
            volumeRenderingRow1.style.display = 'none'
            volumeRenderingRow2.style.display = 'none'
            break
          case 'VolumeRendering':
            volumeRenderingRow1.style.display = 'flex'
            volumeRenderingRow2.style.display = 'flex'
            break
          default:
            console.error('Invalid view mode: ' + viewMode)
        }
      }
    )

    reaction(
      () => {
        return store.imageUI.blendMode
      },
      blendMode => {
        switch (blendMode) {
          case 0:
            volumeRenderingRow1.style.display = 'flex'
            break
          case 1:
          case 2:
          case 3:
            volumeRenderingRow1.style.display = 'none'
            break
          default:
            console.error('Invalid blend mode: ' + blendMode)
        }
      }
    )
  }

  store.mainUI.uiContainer.appendChild(imageUIGroup)
}

export default createImageUI
