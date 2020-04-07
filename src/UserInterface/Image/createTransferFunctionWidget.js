import { reaction, action } from 'mobx'

import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator'
import vtkPiecewiseGaussianWidget from 'vtk.js/Sources/Interaction/Widgets/PiecewiseGaussianWidget'
import macro from 'vtk.js/Sources/macro'

import style from '../ItkVtkViewer.module.css'

function createTransferFunctionWidget(store, uiContainer, use2D) {
  const renderWindow = store.renderWindow

  const transferFunctionWidget = vtkPiecewiseGaussianWidget.newInstance({
    numberOfBins: 256,
    size: [400, 150],
  })
  store.imageUI.transferFunctionWidget = transferFunctionWidget
  transferFunctionWidget.setEnableRangeZoom(true)
  let iconSize = 20
  if (use2D) {
    iconSize = 0
  }
  transferFunctionWidget.updateStyle({
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    histogramColor: 'rgba(30, 30, 30, 0.6)',
    strokeColor: 'rgb(0, 0, 0)',
    activeColor: 'rgb(255, 255, 255)',
    handleColor: 'rgb(70, 70, 150)',
    buttonDisableFillColor: 'rgba(255, 255, 255, 0.5)',
    buttonDisableStrokeColor: 'rgba(0, 0, 0, 0.5)',
    buttonStrokeColor: 'rgba(0, 0, 0, 1)',
    buttonFillColor: 'rgba(255, 255, 255, 1)',
    strokeWidth: 2,
    activeStrokeWidth: 3,
    buttonStrokeWidth: 1.5,
    handleWidth: 2,
    zoomControlHeight: 20,
    zoomControlColor: 'rgba(50, 50, 100, 1)',
    iconSize, // Can be 0 if you want to remove buttons (dblClick for (+) / rightClick for (-))
    padding: 10,
  })
  const dataArray = store.imageUI.image.getPointData().getScalars()
  transferFunctionWidget.setDataArray(dataArray.getData(), {
    numberOfComponents: store.imageUI.numberOfComponents,
    component: store.imageUI.selectedComponentIndex,
  })

  const piecewiseWidgetContainer = document.createElement('div')
  piecewiseWidgetContainer.setAttribute('class', style.piecewiseWidget)

  transferFunctionWidget.setContainer(piecewiseWidgetContainer)
  transferFunctionWidget.bindMouseListeners()

  // Manage update when opacity changes
  transferFunctionWidget.onAnimation(start => {
    if (start) {
      renderWindow.getInteractor().requestAnimation(transferFunctionWidget)
    } else {
      renderWindow.getInteractor().cancelAnimation(transferFunctionWidget)
      renderWindow.render()
    }
  })
  transferFunctionWidget.onOpacityChange(() => {
    const component = store.imageUI.selectedComponentIndex
    const lookupTableProxy = store.imageUI.lookupTableProxies[component]
    const lookupTable = lookupTableProxy.getLookupTable()
    const piecewiseFunction = store.imageUI.piecewiseFunctionProxies[
      component
    ].getPiecewiseFunction()
    if (!use2D) {
      transferFunctionWidget.applyOpacity(piecewiseFunction)
    }
    const colorDataRange = transferFunctionWidget.getOpacityRange()
    lookupTable.setMappingRange(...colorDataRange)
    lookupTable.updateRange()

    if (!renderWindow.getInteractor().isAnimating()) {
      renderWindow.render()
    }
  })
  reaction(
    () => {
      return store.imageUI.colorRanges.slice()
    },
    colorRanges => {
      const component = store.imageUI.selectedComponentIndex
      const colorRange = colorRanges[component]
      const gaussians = transferFunctionWidget.getGaussians()
      const newGaussians = gaussians.slice()
      const dataArray = store.imageUI.image.getPointData().getScalars()
      const fullRange = dataArray.getRange(component)
      const diff = fullRange[1] - fullRange[0]
      const colorRangeNormalized = new Array(2)
      colorRangeNormalized[0] = (colorRange[0] - fullRange[0]) / diff
      colorRangeNormalized[1] = (colorRange[1] - fullRange[0]) / diff

      let minValue = Infinity
      let maxValue = -Infinity

      let count = gaussians.length
      while (count--) {
        let { position, width, xBias, yBias } = newGaussians[count]
        if (position - width < colorRangeNormalized[0]) {
          position = colorRangeNormalized[0] + width
          newGaussians[count].position = position
          if (position + width > colorRangeNormalized[1]) {
            const newWidth =
              (colorRangeNormalized[1] - colorRangeNormalized[0]) / 2
            position = colorRangeNormalized[0] + newWidth
            newGaussians[count].position = position
            newGaussians[count].width = newWidth
            newGaussians[count].xBias = (newWidth / width) * xBias
            newGaussians[count].yBias = (newWidth / width) * yBias
          }
        }
        if (position + width > colorRangeNormalized[1]) {
          position = colorRangeNormalized[1] - width
          newGaussians[count].position = position
          if (position - width < colorRangeNormalized[0]) {
            const newWidth =
              (colorRangeNormalized[1] - colorRangeNormalized[0]) / 2
            position = colorRangeNormalized[0] + newWidth
            newGaussians[count].position = position
            newGaussians[count].width = newWidth
            newGaussians[count].xBias = (newWidth / width) * xBias
            newGaussians[count].yBias = (newWidth / width) * yBias
          }
        }
        minValue = Math.min(minValue, position - width)
        maxValue = Math.max(maxValue, position + width)
      }
      if (
        colorRangeNormalized[0] < minValue ||
        colorRangeNormalized[1] > maxValue
      ) {
        const newWidth = (colorRangeNormalized[1] - colorRangeNormalized[0]) / 2
        const position = colorRangeNormalized[0] + newWidth
        newGaussians[0].position = position
        newGaussians[0].xBias =
          (newWidth / newGaussians[0].width) * newGaussians[0].xBias
        newGaussians[0].yBias =
          (newWidth / newGaussians[0].width) * newGaussians[0].yBias
        newGaussians[0].width = newWidth
      }
      transferFunctionWidget.setRangeZoom(colorRangeNormalized)
      store.imageUI.opacityGaussians[component] = newGaussians
      transferFunctionWidget.setGaussians(newGaussians)
    }
  )
  const onZoomChange = action(zoom => {
    const component = store.imageUI.selectedComponentIndex
    const dataArray = store.imageUI.image.getPointData().getScalars()
    const fullRange = dataArray.getRange(component)
    const diff = fullRange[1] - fullRange[0]
    const colorRange = new Array(2)
    colorRange[0] = fullRange[0] + zoom[0] * diff
    colorRange[1] = fullRange[0] + zoom[1] * diff
    store.imageUI.colorRanges[component] = colorRange
  })
  transferFunctionWidget.onZoomChange(macro.throttle(onZoomChange, 150))

  function updateTransferFunctionLookupTable(index) {
    const lookupTable = store.imageUI.lookupTableProxies[index].getLookupTable()
    transferFunctionWidget.setColorTransferFunction(lookupTable)
    const colorDataRange = transferFunctionWidget.getOpacityRange()
    lookupTable.setMappingRange(...colorDataRange)
    lookupTable.updateRange()
  }
  reaction(
    () => {
      return store.imageUI.selectedComponentIndex
    },
    index => {
      const colorRange = store.imageUI.colorRanges[index]
      const numberOfComponents = store.imageUI.numberOfComponents
      const dataArray = store.imageUI.image.getPointData().getScalars()
      transferFunctionWidget.setDataArray(dataArray.getData(), {
        numberOfComponents: numberOfComponents,
        component: index,
      })
      transferFunctionWidget.setGaussians(store.imageUI.opacityGaussians[index])

      const fullRange = dataArray.getRange(index)
      const diff = fullRange[1] - fullRange[0]
      const colorRangeNormalized = new Array(2)
      colorRangeNormalized[0] = (colorRange[0] - fullRange[0]) / diff
      colorRangeNormalized[1] = (colorRange[1] - fullRange[0]) / diff
      transferFunctionWidget.setRangeZoom(colorRangeNormalized)

      updateTransferFunctionLookupTable(index)

      if (!renderWindow.getInteractor().isAnimating()) {
        renderWindow.render()
      }
    }
  )
  updateTransferFunctionLookupTable(store.imageUI.selectedComponentIndex)

  function setupOpacityGaussians() {
    const numberOfComponents = store.imageUI.numberOfComponents
    for (let component = 0; component < numberOfComponents; component++) {
      if (store.imageUI.opacityGaussians.length <= component) {
        if (use2D) {
          // Necessary side effect: addGaussian calls invokeOpacityChange, which
          // calls onOpacityChange, which updates the lut (does not have a low
          // opacity in 2D)
          store.imageUI.opacityGaussians.push([
            { position: 0.5, height: 1.0, width: 0.5, xBias: 0.0, yBias: 3.0 },
          ])
        } else {
          store.imageUI.opacityGaussians.push([
            { position: 0.5, height: 1.0, width: 0.5, xBias: 0.51, yBias: 0.4 },
          ])
        }
      }
      if (!use2D) {
        transferFunctionWidget.setGaussians(
          store.imageUI.opacityGaussians[component]
        )
        const piecewiseFunction = store.imageUI.piecewiseFunctionProxies[
          component
        ].getPiecewiseFunction()
        transferFunctionWidget.applyOpacity(piecewiseFunction)
      }
    }
    const selectedComponent = store.imageUI.selectedComponentIndex
    transferFunctionWidget.setGaussians(
      store.imageUI.opacityGaussians[selectedComponent]
    )
  }
  reaction(
    () => {
      return store.imageUI.image
    },
    image => {
      setupOpacityGaussians()
    }
  )
  setupOpacityGaussians()

  const transferFunctionWidgetRow = document.createElement('div')
  transferFunctionWidgetRow.setAttribute('class', style.uiRow)
  // This row needs background different from normal uiRows, to aid
  // in the illusion that it's the content portion of a tabbed pane
  transferFunctionWidgetRow.setAttribute(
    'style',
    'background: rgba(127, 127, 127, 0.5);'
  )
  transferFunctionWidgetRow.className += ` ${store.id}-toggle`
  transferFunctionWidgetRow.appendChild(piecewiseWidgetContainer)
  uiContainer.appendChild(transferFunctionWidgetRow)

  // Create range manipulator
  const rangeManipulator = vtkMouseRangeManipulator.newInstance({
    button: 1,
    alt: true,
  })

  // Window
  const windowMotionScale = 150.0
  const windowGet = () => {
    const gaussian = transferFunctionWidget.getGaussians()[0]
    return gaussian.width * windowMotionScale
  }
  const windowSet = value => {
    const gaussians = transferFunctionWidget.getGaussians()
    const newGaussians = gaussians.slice()
    newGaussians[0].width = value / windowMotionScale
    store.imageUI.opacityGaussians[
      store.imageUI.selectedComponentIndex
    ] = newGaussians
    transferFunctionWidget.setGaussians(newGaussians)
  }
  rangeManipulator.setVerticalListener(
    0,
    windowMotionScale,
    1,
    windowGet,
    windowSet
  )

  // Level
  const levelMotionScale = 150.0
  const levelGet = () => {
    const gaussian = transferFunctionWidget.getGaussians()[0]
    return gaussian.position * levelMotionScale
  }
  const levelSet = value => {
    const gaussians = transferFunctionWidget.getGaussians()
    const newGaussians = gaussians.slice()
    newGaussians[0].position = value / levelMotionScale
    store.imageUI.opacityGaussians[
      store.imageUI.selectedComponentIndex
    ] = newGaussians
    transferFunctionWidget.setGaussians(newGaussians)
  }
  rangeManipulator.setHorizontalListener(
    0,
    levelMotionScale,
    1,
    levelGet,
    levelSet
  )

  // Add range manipulator
  store.itkVtkView.getInteractorStyle2D().addMouseManipulator(rangeManipulator)
  store.itkVtkView.getInteractorStyle3D().addMouseManipulator(rangeManipulator)

  const opacityRangeManipulator = vtkMouseRangeManipulator.newInstance({
    button: 3, // Right mouse
    alt: true,
  })
  const opacityRangeManipulatorShift = vtkMouseRangeManipulator.newInstance({
    button: 1, // Left mouse
    shift: true, // For the macOS folks
    alt: true,
  })

  // Opacity
  const opacityMotionScale = 200.0
  const opacityGet = () => {
    const gaussian = transferFunctionWidget.getGaussians()[0]
    return gaussian.height * opacityMotionScale
  }
  const opacitySet = value => {
    const gaussians = transferFunctionWidget.getGaussians()
    const newGaussians = gaussians.slice()
    newGaussians[0].height = value / opacityMotionScale
    store.imageUI.opacityGaussians[
      store.imageUI.selectedComponentIndex
    ] = newGaussians
    transferFunctionWidget.setGaussians(newGaussians)
  }
  opacityRangeManipulator.setVerticalListener(
    0,
    opacityMotionScale,
    1,
    opacityGet,
    opacitySet
  )
  opacityRangeManipulatorShift.setVerticalListener(
    0,
    opacityMotionScale,
    1,
    opacityGet,
    opacitySet
  )
  store.itkVtkView
    .getInteractorStyle3D()
    .addMouseManipulator(opacityRangeManipulator)
  store.itkVtkView
    .getInteractorStyle3D()
    .addMouseManipulator(opacityRangeManipulatorShift)
}

export default createTransferFunctionWidget
