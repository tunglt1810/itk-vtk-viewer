import vtkProxyManager from 'vtk.js/Sources/Proxy/Core/ProxyManager';
import macro from 'vtk.js/Sources/macro';
import vtkLookupTableProxy from 'vtk.js/Sources/Proxy/Core/LookupTableProxy';
import vtkPiecewiseFunctionProxy from 'vtk.js/Sources/Proxy/Core/PiecewiseFunctionProxy';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

import ResizeSensor from 'css-element-queries/src/ResizeSensor';

import proxyConfiguration from './proxyManagerConfiguration';
import UserInterface from './UserInterface';
import addKeyboardShortcuts from './addKeyboardShortcuts';
import rgb2hex from './UserInterface/rgb2hex';
import ViewerStore from './ViewerStore';
import applyCategoricalColorToLookupTableProxy from './UserInterface/applyCategoricalColorToLookupTableProxy';

import { autorun, reaction } from 'mobx';
import addTransferFunctionMouseManipulator from './addTransferFunctionMouseManipulator';

import ColorMaps from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction/ColorMaps';
// import ColorMapsJson from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction/ColorMaps.json';
//
// ColorMapsJson.forEach((colorMap) => { ColorMaps.addPreset(colorMap); });

// ColorMaps.addPreset(ColorMapNo1);

function applyStyle(el, style) {
  Object.keys(style).forEach((key) => {
    el.style[key] = style[key];
  });
}

const createViewer = (
  rootContainer,
  { image, labelMap, geometries, pointSets, use2D = false, rotate = true, viewerStyle, viewerState }
) => {
  UserInterface.emptyContainer(rootContainer);

  const proxyManager = vtkProxyManager.newInstance({ proxyConfiguration });
  window.addEventListener('resize', proxyManager.resizeAllViews);


  // Todo: deserialize from viewerState, if present
  const store = new ViewerStore(proxyManager);

  applyStyle(store.container, store.style.containerStyle);
  rootContainer.appendChild(store.container);
  autorun(() => {
    applyStyle(store.container, store.style.containerStyle);
  })
  autorun(() => {
    store.itkVtkView.setBackground(store.style.backgroundColor);
  })

  if (viewerStyle) {
    store.style = viewerStyle;
  }

  const testCanvas = document.createElement("canvas");
  const gl = testCanvas.getContext("webgl")
      || testCanvas.getContext("experimental-webgl");
  if (!(gl && gl instanceof WebGLRenderingContext)) {
    const suggestion = document.createElement("p");
    const preSuggestionText = document.createTextNode("WebGL could not be loaded. ");
    suggestion.appendChild(preSuggestionText);
    const getWebGLA = document.createElement("a");
    getWebGLA.setAttribute("href", "http://get.webgl.org/troubleshooting");
    const getWebGLAText = document.createTextNode("Try a different browser or video drivers for WebGL support.");
    getWebGLA.appendChild(getWebGLAText);
    suggestion.appendChild(getWebGLA);
    const suggestionText = document.createTextNode(" This is required to view interactive 3D visualizations.");
    suggestion.appendChild(suggestionText);
    store.container.appendChild(suggestion);
    return null;
  }

  UserInterface.addLogo(store.container);

  UserInterface.createMainUI(
    rootContainer,
    store,
    use2D,
  );

  let updatingImage = false;
  if (!!labelMap) {
    store.imageUI.labelMap = labelMap;
  }
  reaction(() => {
      const image = store.imageUI.image;
      const labelMap = store.imageUI.labelMap;
      return store.imageUI.fusedImageLabelMap;
    },

    (fusedImage) => {
      if (!!!fusedImage) {
        return;
      }
      if (!!!store.imageUI.representationProxy) {
        store.imageUI.source.setInputData(fusedImage);

        proxyManager.createRepresentationInAllViews(store.imageUI.source);
        store.imageUI.representationProxy = proxyManager.getRepresentation(store.imageUI.source, store.itkVtkView);

        const numberOfComponents = store.imageUI.numberOfComponents;
        if (!!store.imageUI.image) {
          store.imageUI.lookupTableProxies = new Array(numberOfComponents);
          store.imageUI.piecewiseFunctionProxies = new Array(numberOfComponents);
          store.imageUI.colorMaps = new Array(numberOfComponents);
          store.imageUI.colorRanges = new Array(numberOfComponents);
          const volume = store.imageUI.representationProxy.getVolumes()[0]
          const volumeProperty = volume.getProperty()
          const dataArray = image.getPointData().getScalars();
          for (let component = 0; component < numberOfComponents; component++) {
            store.imageUI.lookupTableProxies[component] = vtkLookupTableProxy.newInstance();
            store.imageUI.piecewiseFunctionProxies[component] = vtkPiecewiseFunctionProxy.newInstance();
            // let preset = 'Viridis (matplotlib)';
            let preset = 'RdOrYl';
            // If a 2D RGB or RGBA
            if (use2D && dataArray.getDataType() === 'Uint8Array' && (numberOfComponents === 3 || numberOfComponents === 4)) {
              preset = 'Grayscale';
            } else if(numberOfComponents === 2) {
              switch (component) {
              case 0:
                preset = 'BkMa';
                break;
              case 1:
                preset = 'BkCy';
                break;
              }
            } else if(numberOfComponents === 3) {
              switch (component) {
              case 0:
                preset = 'BkRd';
                break;
              case 1:
                preset = 'BkGn';
                break;
              case 2:
                preset = 'BkBu';
                break;
              }
            }
            store.imageUI.colorMaps[component] = preset;
            store.imageUI.lookupTableProxies[component].setPresetName(preset);

            const lut = store.imageUI.lookupTableProxies[component].getLookupTable();
            const range = dataArray.getRange(component);
            store.imageUI.colorRanges[component] = range;
            lut.setMappingRange(range[0], range[1]);
            volumeProperty.setRGBTransferFunction(component, lut);

            const piecewiseFunction = store.imageUI.piecewiseFunctionProxies[component].getPiecewiseFunction();
            volumeProperty.setScalarOpacity(component, piecewiseFunction);
            //volumeProperty.setIndependentComponents(numberOfComponents);
          }
        }

        if (!!store.imageUI.labelMap) {
          // label map initialization
          const lutProxy = vtkLookupTableProxy.newInstance()
          store.imageUI.labelMapLookupTableProxy = lutProxy;

          const labelMapScalars = store.imageUI.labelMap.getPointData().getScalars();
          const labelMapData = labelMapScalars.getData();
          const uniqueLabelsSet = new Set(labelMapData);
          const uniqueLabels = Array.from(uniqueLabelsSet);
          // The volume mapper currently only supports ColorTransferFunction's,
          // not LookupTable's
          // lut.setAnnotations(uniqueLabels, uniqueLabels);
          uniqueLabels.sort();
          store.imageUI.labelMapLabels = uniqueLabels;

          applyCategoricalColorToLookupTableProxy(lutProxy, uniqueLabels, store.imageUI.labelMapCategoricalColor);

          const volume = store.imageUI.representationProxy.getVolumes()[0]
          const volumeProperty = volume.getProperty()

          const piecewiseFunction = vtkPiecewiseFunction.newInstance();
          store.imageUI.piecewiseFunction = piecewiseFunction;
          const haveBackground = uniqueLabels[0] === 0 ? true: false;
          if (haveBackground) {
            piecewiseFunction.addPoint(uniqueLabels[0] - 0.5, 0.0, 0.5, 1.0);
          } else {
            piecewiseFunction.addPoint(uniqueLabels[0] - 0.5, 1.0, 0.5, 1.0);
          }
          piecewiseFunction.addPoint(uniqueLabels[1] - 0.5, 1.0, 0.5, 1.0);
          piecewiseFunction.addPoint(uniqueLabels[uniqueLabels.length-1] + 0.5, 1.0, 0.5, 1.0);
          // volumeProperty.setScalarOpacity(numberOfComponents, piecewiseFunction);

          const colorTransferFunction = lutProxy.getLookupTable();
          colorTransferFunction.setMappingRange(uniqueLabels[0], uniqueLabels[uniqueLabels.length-1]);

          volumeProperty.setRGBTransferFunction(numberOfComponents, colorTransferFunction);
          //volumeProperty.setUseGradientOpacity(numberOfComponents, false);
          //volumeProperty.setIndependentComponents(numberOfComponents + 1);
        }


        // Slices share the same lookup table as the volume rendering.
        // Todo use all lookup tables on slice
        if (!!image) {
          const lut = store.imageUI.lookupTableProxies[store.imageUI.selectedComponentIndex].getLookupTable();
          const sliceActors = store.imageUI.representationProxy.getActors();
          sliceActors.forEach((actor) => {
            actor.getProperty().setRGBTransferFunction(lut);
          });
        }

        if (use2D) {
          store.itkVtkView.setViewMode('ZPlane');
          store.itkVtkView.setOrientationAxesVisibility(false);
        } else {
          store.itkVtkView.setViewMode('VolumeRendering');
        }

        UserInterface.createImageUI(
          store,
          use2D
        );
        const annotationContainer = store.container.querySelector('.js-se');
        annotationContainer.style.fontFamily = 'monospace';
      } else {
        if (updatingImage) {
          return;
        }
        updatingImage = true;
        store.imageUI.source.setInputData(fusedImage);
        const transferFunctionWidget = store.imageUI.transferFunctionWidget;
        transferFunctionWidget.setDataArray(store.imageUI.image.getPointData().getScalars().getData());
        transferFunctionWidget.invokeOpacityChange(transferFunctionWidget);
        transferFunctionWidget.modified();
        store.imageUI.croppingWidget.setVolumeMapper(store.imageUI.representationProxy.getMapper());
        const cropFilter = store.imageUI.representationProxy.getCropFilter();
        cropFilter.reset();
        store.imageUI.croppingWidget.resetWidgetState();
        setTimeout(() => {
          transferFunctionWidget.render();
          store.renderWindow.render();
          updatingImage = false;
        }, 0);
      }
    }
  );
  store.imageUI.image = image;
  if (!!labelMap && !!!image) {
    // trigger reaction
    store.imageUI.labelMap = null;
    store.imageUI.labelMap = labelMap;
  }

  reaction(() => !!store.geometriesUI.geometries && store.geometriesUI.geometries.slice(),
    (geometries) => {
      if(!!!geometries || geometries.length === 0) {
        return;
      }

      geometries.forEach((geometry, index) => {
        if (store.geometriesUI.sources.length <= index) {
          const uid = `GeometrySource${index}`
          const geometrySource = proxyManager.createProxy('Sources', 'TrivialProducer', {
            name: uid,
          });
          store.geometriesUI.sources.push(geometrySource)
          store.geometriesUI.sources[index].setInputData(geometry)
          proxyManager.createRepresentationInAllViews(geometrySource);
          const geometryRepresentation = proxyManager.getRepresentation(geometrySource, store.itkVtkView);
          store.geometriesUI.representationProxies.push(geometryRepresentation);
        } else {
          store.geometriesUI.sources[index].setInputData(geometry);
          store.geometriesUI.representationProxies[index].setVisibility(true);
        }
      })

      if(geometries.length < store.geometriesUI.representationProxies.length) {
        const proxiesToDisable = store.geometriesUI.representationProxies.slice(geometries.length);
        proxiesToDisable.forEach((proxy) => {
          proxy.setVisibility(false);
        })
      }

      if(!store.geometriesUI.initialized) {
        UserInterface.createGeometriesUI(
          store,
        );
      }
      store.geometriesUI.names = geometries.map((geometry, index) => `Geometry ${index}`);
      let representations = store.geometriesUI.representations.slice(0, geometries.length);
      const defaultGeometryRepresentations = new Array(geometries.length);
      defaultGeometryRepresentations.fill('Surface');
      representations.concat(defaultGeometryRepresentations.slice(0, geometries.length - representations.length));
      store.geometriesUI.representations = representations;
    }
  );
  store.geometriesUI.geometries = geometries;

  reaction(() => !!store.pointSetsUI.pointSets && store.pointSetsUI.pointSets.slice(),
    (pointSets) => {
      if(!!!pointSets || pointSets.length === 0) {
        return;
      }

      pointSets.forEach((pointSet, index) => {
        if (store.pointSetsUI.sources.length <= index) {
          const uid = `PointSetSource${index}`
          const pointSetSource = proxyManager.createProxy('Sources', 'TrivialProducer', {
            name: uid,
          });
          store.pointSetsUI.sources.push(pointSetSource)
          store.pointSetsUI.sources[index].setInputData(pointSet)
          const pointSetRepresentationUid = `pointSetRepresentation${index}`
          const pointSetRepresentation = proxyManager.createProxy('Representations', 'PointSet', {
            name: pointSetRepresentationUid,
          });
          pointSetRepresentation.setInput(pointSetSource);
          store.itkVtkView.addRepresentation(pointSetRepresentation);
          store.pointSetsUI.representationProxies.push(pointSetRepresentation);
        } else {
          store.pointSetsUI.sources[index].setInputData(pointSet);
          store.pointSetsUI.representationProxies[index].setVisibility(true);
        }
      })

      if(pointSets.length < store.pointSetsUI.representationProxies.length) {
        const proxiesToDisable = store.pointSetsUI.representationProxies.slice(pointSets.length);
        proxiesToDisable.forEach((proxy) => {
          proxy.setVisibility(false);
        })
      }

      // Estimate a reasonable point sphere radius in pixels
      const maxLength = pointSets.reduce((max, pointSet) => {
        pointSet.computeBounds();
        const bounds = pointSet.getBounds();
        max = Math.max(max, bounds[1] - bounds[0]);
        max = Math.max(max, bounds[3] - bounds[2]);
        max = Math.max(max, bounds[5] - bounds[4]);
        return max;
      }, -Infinity);
      const maxNumberOfPoints = pointSets.reduce((max, pointSet) => {
        max = Math.max(max, pointSet.getPoints().getNumberOfPoints());
        return max;
      }, -Infinity);
      const radiusFactor = maxLength / ((1.0 + Math.log(maxNumberOfPoints)) * 30);
      store.pointSetsUI.representationProxies.forEach((proxy) => {
        proxy.setRadiusFactor(radiusFactor);
      })

      if(!store.pointSetsUI.initialized) {
        UserInterface.createPointSetsUI(
          store
        );
      }
    }
  );
  store.pointSetsUI.pointSets = pointSets;

  store.itkVtkView.resize();
  const resizeSensor = new ResizeSensor(store.container, function() {
    store.itkVtkView.resize();
  });
  proxyManager.renderAllViews();

  setTimeout(store.itkVtkView.resetCamera, 1);

  const publicAPI = {};

  publicAPI.renderLater = () => {
    store.itkVtkView.renderLater();
  }

  const viewerDOMId = store.id;

  const setImage = (image) => {
    store.imageUI.image = image;
  }
  publicAPI.setImage = macro.throttle(setImage, 100);

  publicAPI.getLookupTableProxies = () => {
    return store.imageUI.lookupTableProxies;
  }

  publicAPI.setPointSets = (pointSets) => {
    store.pointSetsUI.pointSets = pointSets;
  }

  publicAPI.setGeometries = (geometries) => {
    store.geometriesUI.geometries = geometries;
  }

  publicAPI.setUserInterfaceCollapsed = (collapse) => {
    const collapsed = store.mainUI.collapsed;
    if (collapse && !collapsed || !collapse && collapsed) {
      store.mainUI.collapsed = !collapsed;
    }
  }

  publicAPI.getUserInterfaceCollapsed = () => {
    return store.mainUI.collapsed;
  }

  const toggleUserInterfaceCollapsedHandlers = [];
  autorun(() => {
    const collapsed = store.mainUI.collapsed;
    toggleUserInterfaceCollapsedHandlers.forEach((handler) => {
      handler.call(null, collapsed);
    })
  })

  publicAPI.subscribeToggleUserInterfaceCollapsed = (handler) => {
    const index = toggleUserInterfaceCollapsedHandlers.length;
    toggleUserInterfaceCollapsedHandlers.push(handler);
    function unsubscribe() {
      toggleUserInterfaceCollapsedHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  // Start collapsed on mobile devices or small pages
  if (window.screen.availWidth < 768 || window.screen.availHeight < 800) {
    publicAPI.setUserInterfaceCollapsed(true);
  }


  publicAPI.captureImage = () => {
    return store.itkVtkView.captureImage();
  }


  const toggleAnnotationsHandlers = [];
  autorun(() => {
    const enabled = store.mainUI.annotationsEnabled;
    toggleAnnotationsHandlers.forEach((handler) => {
      handler.call(null, enabled);
    })
  })

  publicAPI.subscribeToggleAnnotations = (handler) => {
    const index = toggleAnnotationsHandlers.length;
    toggleAnnotationsHandlers.push(handler);
    function unsubscribe() {
      toggleAnnotationsHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  publicAPI.setAnnotationsEnabled = (enabled) => {
    const annotations = store.mainUI.annotationsEnabled;
    if (enabled && !annotations || !enabled && annotations) {
      store.mainUI.annotationsEnabled = enabled;
    }
  }


  const toggleRotateHandlers = [];
  autorun(() => {
    const enabled = store.mainUI.rotateEnabled;
    toggleRotateHandlers.forEach((handler) => {
      handler.call(null, enabled);
    })
  })

  publicAPI.subscribeToggleRotate = (handler) => {
    const index = toggleRotateHandlers.length;
    toggleRotateHandlers.push(handler);
    function unsubscribe() {
      toggleRotateHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  publicAPI.setRotateEnabled = (enabled) => {
    const rotate = store.mainUI.rotateEnabled;
    if (enabled && !rotate || !enabled && rotate) {
      store.mainUI.rotateEnabled = enabled;
    }
  }


  const toggleFullscreenHandlers = [];
  autorun(() => {
    const enabled = store.mainUI.fullscreenEnabled;
    toggleFullscreenHandlers.forEach((handler) => {
      handler.call(null, enabled);
    })
  })

  publicAPI.subscribeToggleFullscreen = (handler) => {
    const index = toggleFullscreenHandlers.length;
    toggleFullscreenHandlers.push(handler);
    function unsubscribe() {
      toggleFullscreenHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  publicAPI.setFullscreenEnabled = (enabled) => {
    const fullscreen = store.mainUI.fullscreenEnabled;
    if (enabled && !fullscreen || !enabled && fullscreen) {
      store.mainUI.fullscreenEnabled = enabled;
    }
  }


  const toggleInterpolationHandlers = [];
  autorun(() => {
    const enabled = store.mainUI.interpolationEnabled;
    toggleInterpolationHandlers.forEach((handler) => {
      handler.call(null, enabled);
    })
  })

  publicAPI.subscribeToggleInterpolation = (handler) => {
    const index = toggleInterpolationHandlers.length;
    toggleInterpolationHandlers.push(handler);
    function unsubscribe() {
      toggleInterpolationHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  publicAPI.setInterpolationEnabled = (enabled) => {
    const interpolation = store.mainUI.interpolationEnabled;
    if (enabled && !interpolation || !enabled && interpolation) {
      store.mainUI.interpolationEnabled = enabled;
    }
  }


  const toggleCroppingPlanesHandlers = [];
  autorun(() => {
    const enabled = store.mainUI.croppingPlanesEnabled;
    toggleCroppingPlanesHandlers.forEach((handler) => {
      handler.call(null, enabled);
    })
  })

  publicAPI.subscribeToggleCroppingPlanes = (handler) => {
    const index = toggleCroppingPlanesHandlers.length;
    toggleCroppingPlanesHandlers.push(handler);
    function unsubscribe() {
      toggleCroppingPlanesHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  publicAPI.setCroppingPlanesEnabled = (enabled) => {
    // const cropping = store.mainUI.croppingPlanesEnabled;
    // if (enabled && !cropping || !enabled && cropping) {
      store.mainUI.croppingPlanesEnabled = enabled;
    // }
  }

  publicAPI.subscribeCroppingPlanesChanged = (handler) => {
    return store.imageUI.addCroppingPlanesChangedHandler(handler);
  }

  publicAPI.subscribeResetCrop = (handler) => {
    return store.imageUI.addResetCropHandler(handler);
  }


  const changeColorRangeHandlers = [];
  autorun(() => {
    const colorRanges = store.imageUI.colorRanges;
    const selectedComponentIndex = store.imageUI.selectedComponentIndex;
    changeColorRangeHandlers.forEach((handler) => {
      handler.call(null, componentIndex, colorRanges[componentIndex]);
    })
  })

  publicAPI.subscribeChangeColorRange = (handler) => {
    const index = changeColorRangeHandlers.length;
    changeColorRangeHandlers.push(handler);
    function unsubscribe() {
      changeColorRangeHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  publicAPI.setColorRange = (componentIndex, colorRange) => {
    const currentColorRange = store.imageUI.colorRanges[componentIndex];
    if (currentColorRange[0] !== colorRange[0] || currentColorRange[1] !== colorRange[1]) {
      store.imageUI.colorRanges[componentIndex] = colorRange;
    }
  }

  publicAPI.getColorRange = (componentIndex) => {
    return store.imageUI.colorRanges[componentIndex];
  }


  const selectColorMapHandlers = [];
  autorun(() => {
    const selectedComponentIndex = store.imageUI.selectedComponentIndex;
    if (store.imageUI.colorMaps) {
      const colorMap = store.imageUI.colorMaps[selectedComponentIndex];
      selectColorMapHandlers.forEach((handler) => {
        handler.call(null, selectedComponentIndex, colorMap);
      })
    }
  })

  publicAPI.subscribeSelectColorMap = (handler) => {
    const index = selectColorMapHandlers.length;
    selectColorMapHandlers.push(handler);
    function unsubscribe() {
      selectColorMapHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  publicAPI.setColorMap = (componentIndex, colorMap) => {
    const currentColorMap = store.imageUI.colorMaps[componentIndex];
    if (currentColorMap !== colorMap) {
      store.imageUI.colorMaps[componentIndex] = colorMap;
    }
  }

  publicAPI.getColorMap = (componentIndex) => {
    return store.imageUI.colorMaps[componentIndex];
  }


  if (!use2D) {
    const viewModeChangedHandlers = [];
    reaction(() => { return store.mainUI.viewMode; },
      (viewMode) => {
        switch(viewMode) {
        case 'XPlane':
          viewModeChangedHandlers.forEach((handler) => {
            handler.call(null, 'XPlane');
          })
          break;
        case 'YPlane':
          viewModeChangedHandlers.forEach((handler) => {
            handler.call(null, 'YPlane');
          })
          break;
        case 'ZPlane':
          viewModeChangedHandlers.forEach((handler) => {
            handler.call(null, 'ZPlane');
          })
          break;
        case 'VolumeRendering':
          viewModeChangedHandlers.forEach((handler) => {
            handler.call(null, 'VolumeRendering');
          })
          break;
        default:
          console.error('Invalid view mode: ' + viewMode);
        }
      }
    )

    publicAPI.subscribeViewModeChanged = (handler) => {
      const index = viewModeChangedHandlers.length;
      viewModeChangedHandlers.push(handler);
      function unsubscribe() {
        viewModeChangedHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }

    publicAPI.setViewMode = (mode) => {
      if (!image) {
        return
      }
      store.mainUI.viewMode = mode;
    }

    const xSliceChangedHandlers = [];
    const xSliceChangedListener = (event) => {
      xSliceChangedHandlers.forEach((handler) => {
        handler.call(null, event.target.valueAsNumber);
      })
    }
    const xSliceElement = document.getElementById(`${viewerDOMId}-xSlice`);
    xSliceElement && xSliceElement.addEventListener('input', xSliceChangedListener);
    publicAPI.subscribeXSliceChanged = (handler) => {
      const index = xSliceChangedHandlers.length;
      xSliceChangedHandlers.push(handler);
      function unsubscribe() {
        xSliceChangedHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }

    const ySliceChangedHandlers = [];
    const ySliceChangedListener = (event) => {
      ySliceChangedHandlers.forEach((handler) => {
        handler.call(null, event.target.valueAsNumber);
      })
    }
    const ySliceElement = document.getElementById(`${viewerDOMId}-ySlice`);
    ySliceElement && ySliceElement.addEventListener('input', ySliceChangedListener);
    publicAPI.subscribeYSliceChanged = (handler) => {
      const index = ySliceChangedHandlers.length;
      ySliceChangedHandlers.push(handler);
      function unsubscribe() {
        ySliceChangedHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }

    const zSliceChangedHandlers = [];
    const zSliceChangedListener = (event) => {
      zSliceChangedHandlers.forEach((handler) => {
        handler.call(null, event.target.valueAsNumber);
      })
    }
    const zSliceElement = document.getElementById(`${viewerDOMId}-zSlice`);
    zSliceElement && zSliceElement.addEventListener('input', zSliceChangedListener);
    publicAPI.subscribeZSliceChanged = (handler) => {
      const index = zSliceChangedHandlers.length;
      zSliceChangedHandlers.push(handler);
      function unsubscribe() {
        zSliceChangedHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }


    const toggleShadowHandlers = [];
    autorun(() => {
      const enabled = store.imageUI.useShadow;
      toggleShadowHandlers.forEach((handler) => {
        handler.call(null, enabled);
      })
    })

    publicAPI.subscribeToggleShadow = (handler) => {
      const index = toggleShadowHandlers.length;
      toggleShadowHandlers.push(handler);
      function unsubscribe() {
        toggleShadowHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }

    publicAPI.setShadowEnabled = (enabled) => {
      const shadow = store.imageUI.useShadow;
      if (enabled && !shadow || !enabled && shadow) {
        store.imageUI.useShadow = enabled;
      }
    }


    const toggleSlicingPlanesHandlers = [];
    autorun(() => {
      const enabled = store.imageUI.slicingPlanesEnabled;
      toggleSlicingPlanesHandlers.forEach((handler) => {
        handler.call(null, enabled);
      })
    })

    publicAPI.subscribeToggleSlicingPlanes = (handler) => {
      const index = toggleSlicingPlanesHandlers.length;
      toggleSlicingPlanesHandlers.push(handler);
      function unsubscribe() {
        toggleSlicingPlanesHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }

    publicAPI.setSlicingPlanesEnabled = (enabled) => {
      const slicingPlanes = store.imageUI.slicingPlanesEnabled;
      if (enabled && !slicingPlanes || !enabled && slicingPlanes) {
        store.imageUI.slicingPlanesEnabled = enabled;
      }
    }


    const gradientOpacitySliderHandlers = [];
    autorun(() => {
      const gradientOpacity = store.imageUI.gradientOpacity;
      gradientOpacitySliderHandlers.forEach((handler) => {
        handler.call(null, gradientOpacity);
      })
    })

    publicAPI.subscribeGradientOpacityChanged = (handler) => {
      const index = gradientOpacitySliderHandlers.length;
      gradientOpacitySliderHandlers.push(handler);
      function unsubscribe() {
        gradientOpacitySliderHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }

    publicAPI.setGradientOpacity = (opacity) => {
      const currentOpacity = store.imageUI.gradientOpacity;
      if (currentOpacity !== parseFloat(opacity)) {
        store.imageUI.gradientOpacity = opacity;
      }
    }


    const blendModeHandlers = [];
    autorun(() => {
      const blendMode = store.imageUI.blendMode;
      blendModeHandlers.forEach((handler) => {
        handler.call(null, blendMode);
      })
    })

    publicAPI.subscribeBlendModeChanged = (handler) => {
      const index = blendModeHandlers.length;
      blendModeHandlers.push(handler);
      function unsubscribe() {
        blendModeHandlers[index] = null;
      }
      return Object.freeze({ unsubscribe });
    }

    publicAPI.setBlendMode = (blendMode) => {
      const currentBlendMode = store.imageUI.blendMode;
      if (currentBlendMode !== parseFloat(blendMode)) {
        store.imageUI.blendMode = blendMode;
      }
    }

  }

  //publicAPI.subscribeSelectColorMap = (handler) => {
    //const index = inputPointSetColorHandlers.length;
    //inputPointSetColorHandlers.push(handler);
    //function unsubscribe() {
      //inputPointSetColorHandlers[index] = null;
    //}
    //return Object.freeze({ unsubscribe });
  //}

  publicAPI.setPointSetColor = (index, rgbColor) => {
    const hexColor = rgb2hex(rgbColor);
    if (index < store.pointSetsUI.colors.length) {
      store.pointSetsUI.colors[index] = hexColor;
    }
  }

  publicAPI.setPointSetOpacity = (index, opacity) => {
    if (index < store.pointSetsUI.opacities.length) {
      store.pointSetsUI.opacities[index] = opacity;
    }
  }

  publicAPI.setPointSetRepresentation = (index, representation) => {
    if (index < store.pointSetsUI.representations.length) {
      store.pointSetsUI.representations[index] = representation;
    }
  }

  const pointSetRepresentationChangedHandlers = [];
  reaction(() => { return store.pointSetsUI.representations.slice(); },
    (representations) => {
      const selectedPointSetIndex = store.pointSetsUI.selectedPointSetIndex;
      const representation = representations[selectedPointSetIndex];
      pointSetRepresentationChangedHandlers.forEach((handler) => {
        handler.call(null, selectedPointSetIndex, representation);
      })
    }
  )
  publicAPI.subscribePointSetRepresentationChanged = (handler) => {
    const index = pointSetRepresentationChangedHandlers.length;
    pointSetRepresentationChangedHandlers.push(handler);
    function unsubscribe() {
      pointSetRepresentationChangedHandlers[index] = null;
    }
    return Object.freeze({ unsubscribe });
  }

  //publicAPI.subscribeSelectColorMap = (handler) => {
    //const index = inputGeometryColorHandlers.length;
    //inputGeometryColorHandlers.push(handler);
    //function unsubscribe() {
      //inputGeometryColorHandlers[index] = null;
    //}
    //return Object.freeze({ unsubscribe });
  //}

  publicAPI.setGeometryColor = (index, rgbColor) => {
    const hexColor = rgb2hex(rgbColor);
    store.geometriesUI.colors[index] = hexColor;
  }

  publicAPI.setGeometryOpacity = (index, opacity) => {
    store.geometriesUI.opacities[index] = opacity;
  }

  publicAPI.getViewProxy = () => {
    return store.itkVtkView;
  }

  //publicAPI.saveState = () => {
    //// todo
  //}

  //publicAPI.loadState = (state) => {
    //// todo
  //}
  addKeyboardShortcuts(rootContainer, publicAPI, viewerDOMId);

  if (!use2D) {
    publicAPI.setRotateEnabled(rotate)
  }

  const div = document.createElement('div');
  const btnRotate = document.createElement('button');
  btnRotate.innerHTML = 'Rotate';
  div.appendChild(btnRotate);
  const btnWindow = document.createElement('button');
  btnWindow.innerHTML = 'Window';
  div.appendChild(btnWindow);
  const btnZoom = document.createElement('button');
  btnZoom.innerHTML = 'Zoom';
  div.appendChild(btnZoom);
  const btnPan = document.createElement('button');
  btnPan.innerHTML = 'Pan';
  div.appendChild(btnPan);
  const btnCrop = document.createElement('button');
  btnCrop.innerHTML = 'Crop';
  div.appendChild(btnCrop);
  const btnReset = document.createElement('button');
  btnReset.innerHTML = 'Reset';
  div.appendChild(btnReset);
  const btnRandomColorMap = document.createElement('button');
  btnRandomColorMap.innerHTML = 'Random colorMap';
  div.appendChild(btnRandomColorMap);
  store.mainUI.uiContainer.appendChild(div);

  const colorMaps = ["KAAMS","Cool to Warm","Cool to Warm (Extended)","Warm to Cool","Warm to Cool (Extended)","Rainbow Desaturated","Cold and Hot","Black-Body Radiation","X Ray","Grayscale","BkRd","BkGn","BkBu","BkMa","BkCy","Black, Blue and White","Black, Orange and White","Linear YGB 1211g","Linear Green (Gr4L)","Linear Blue (8_31f)","Blue to Red Rainbow","Red to Blue Rainbow","Rainbow Blended White","Rainbow Blended Grey","Rainbow Blended Black","Blue to Yellow","blot","CIELab Blue to Red","jet","rainbow","erdc_rainbow_bright","erdc_rainbow_dark","nic_CubicL","nic_CubicYF","gist_earth","2hot","erdc_red2yellow_BW","erdc_marine2gold_BW","erdc_blue2gold_BW","erdc_sapphire2gold_BW","erdc_red2purple_BW","erdc_purple2pink_BW","erdc_pbj_lin","erdc_blue2green_muted","erdc_blue2green_BW","GREEN-WHITE_LINEAR","erdc_green2yellow_BW","blue2cyan","erdc_blue2cyan_BW","erdc_blue_BW","BLUE-WHITE","erdc_purple_BW","erdc_magenta_BW","magenta","RED-PURPLE","erdc_red_BW","RED_TEMPERATURE","erdc_orange_BW","heated_object","erdc_gold_BW","erdc_brown_BW","copper_Matlab","pink_Matlab","bone_Matlab","gray_Matlab","Purples","Blues","Greens","PuBu","BuPu","BuGn","GnBu","GnBuPu","BuGnYl","PuRd","RdPu","Oranges","Reds","RdOr","BrOrYl","RdOrYl","CIELab_blue2red","blue2yellow","erdc_blue2gold","erdc_blue2yellow","erdc_cyan2orange","erdc_purple2green","erdc_purple2green_dark","coolwarm","BuRd","Spectral_lowBlue","GnRP","GYPi","GnYlRd","GBBr","PuOr","PRGn","PiYG","OrPu","BrBG","GyRd","erdc_divHi_purpleGreen","erdc_divHi_purpleGreen_dim","erdc_divLow_icePeach","erdc_divLow_purpleGreen","Haze_green","Haze_lime","Haze","Haze_cyan","nic_Edge","erdc_iceFire_H","erdc_iceFire_L","hsv","hue_L60","Spectrum","Warm","Cool","Blues","Wild Flower","Citrus","Brewer Diverging Purple-Orange (11)","Brewer Diverging Purple-Orange (10)","Brewer Diverging Purple-Orange (9)","Brewer Diverging Purple-Orange (8)","Brewer Diverging Purple-Orange (7)","Brewer Diverging Purple-Orange (6)","Brewer Diverging Purple-Orange (5)","Brewer Diverging Purple-Orange (4)","Brewer Diverging Purple-Orange (3)","Brewer Diverging Spectral (11)","Brewer Diverging Spectral (10)","Brewer Diverging Spectral (9)","Brewer Diverging Spectral (8)","Brewer Diverging Spectral (7)","Brewer Diverging Spectral (6)","Brewer Diverging Spectral (5)","Brewer Diverging Spectral (4)","Brewer Diverging Spectral (3)","Brewer Diverging Brown-Blue-Green (11)","Brewer Diverging Brown-Blue-Green (10)","Brewer Diverging Brown-Blue-Green (9)","Brewer Diverging Brown-Blue-Green (8)","Brewer Diverging Brown-Blue-Green (7)","Brewer Diverging Brown-Blue-Green (6)","Brewer Diverging Brown-Blue-Green (5)","Brewer Diverging Brown-Blue-Green (4)","Brewer Diverging Brown-Blue-Green (3)","Brewer Sequential Blue-Green (9)","Brewer Sequential Blue-Green (8)","Brewer Sequential Blue-Green (7)","Brewer Sequential Blue-Green (6)","Brewer Sequential Blue-Green (5)","Brewer Sequential Blue-Green (4)","Brewer Sequential Blue-Green (3)","Brewer Sequential Yellow-Orange-Brown (9)","Brewer Sequential Yellow-Orange-Brown (8)","Brewer Sequential Yellow-Orange-Brown (7)","Brewer Sequential Yellow-Orange-Brown (6)","Brewer Sequential Yellow-Orange-Brown (5)","Brewer Sequential Yellow-Orange-Brown (4)","Brewer Sequential Yellow-Orange-Brown (3)","Brewer Sequential Blue-Purple (9)","Brewer Sequential Blue-Purple (8)","Brewer Sequential Blue-Purple (7)","Brewer Sequential Blue-Purple (6)","Brewer Sequential Blue-Purple (5)","Brewer Sequential Blue-Purple (4)","Brewer Sequential Blue-Purple (3)","Brewer Qualitative Accent","Brewer Qualitative Dark2","Brewer Qualitative Set2","Brewer Qualitative Pastel2","Brewer Qualitative Pastel1","Brewer Qualitative Set1","Brewer Qualitative Paired","Brewer Qualitative Set3","Traffic Lights","Traffic Lights For Deuteranopes","Traffic Lights For Deuteranopes 2","Muted Blue-Green","Green-Blue Asymmetric Divergent (62Blbc)","Asymmtrical Earth Tones (6_21b)","Yellow 15","Magma (matplotlib)","Inferno (matplotlib)","Plasma (matplotlib)","Viridis (matplotlib)","BlueObeliskElements"];
  btnRotate.addEventListener('click', () => { publicAPI.setActiveTool('Rotate'); });
  btnWindow.addEventListener('click', () => { publicAPI.setActiveTool('Wwwc'); });
  btnZoom.addEventListener('click', () => { publicAPI.setActiveTool('Zoom'); });
  btnPan.addEventListener('click', () => { publicAPI.setActiveTool('Pan'); });
  btnCrop.addEventListener('click', () => { publicAPI.togglePassiveTool('Crop'); });
  btnReset.addEventListener('click', () => { publicAPI.resetViewport(); });
  let colorMapIndex = 0;
  btnRandomColorMap.addEventListener('click', () => {
    console.log('select color map index', colorMapIndex, colorMaps[colorMapIndex]);
    // publicAPI.setColorMap(colorMaps[colorMapIndex]);
    // colorMapIndex = (colorMapIndex + 1) % colorMaps.length;
    // console.log('set color map no 1');

    publicAPI.setColorMap(colorMaps[colorMapIndex]);

    colorMapIndex = (colorMapIndex + 1) % colorMaps.length;
  });

  const defaultPresets = [
    { type: 'pan', options: { button: 3 } }, // Pan on Right button drag
    { type: 'zoom', options: { dragEnabled: false, scrollEnabled: true } }, // Zoom on scroll
    { type: 'rotate', options: { button: 1, control: true } }, // Zoom on Ctrl + Left button drag
  ];

  const inractorPresets = {
    Rotate: [{ type: 'rotate', options: { button: 1 } }, ...defaultPresets],
    Zoom: [{ type: 'zoom', options: { button: 1 } }, ...defaultPresets],
    Pan: [{ type: 'pan', options: { button: 1 } }, ...defaultPresets],
  };

  publicAPI.setActiveTool = (activeTool) => {
    store.activeTool = activeTool;
    // console.log('set active tool', activeTool);
    store.itkVtkView.getInteractorStyle3D().removeAllMouseManipulators();
    switch (activeTool) {
      case 'Rotate':
        store.itkVtkView.setPresetToInteractor3D(inractorPresets.Rotate);
        break;
      case 'Wwwc':
        store.itkVtkView.setPresetToInteractor3D(defaultPresets);
        addTransferFunctionMouseManipulator(store);
        break;
      case 'Zoom':
        store.itkVtkView.setPresetToInteractor3D(inractorPresets.Zoom);
        break;
      case 'Pan':
        store.itkVtkView.setPresetToInteractor3D(inractorPresets.Pan);
        break;
      default: break;
    }
  };

  publicAPI.togglePassiveTool = (passiveTool) => {
    switch (passiveTool) {
      case 'Crop':
        publicAPI.setCroppingPlanesEnabled(!store.mainUI.croppingPlanesEnabled);
        break;
      default: break;
    }
  };

  publicAPI.resetViewport = () => {
    store.imageUI.representationProxy.getCropFilter().reset();
    store.imageUI.croppingWidget.resetWidgetState();
    store.itkVtkView.resetCamera();
  };

  publicAPI.setColorMap = (colorMap) => {
    const componentIndex = store.imageUI.selectedComponentIndex;
    const lookupTableProxy = store.imageUI.lookupTableProxies[componentIndex];
    const transferFunctionWidget = store.imageUI.transferFunctionWidget;
    const piecewiseFunction = store.imageUI.piecewiseFunctionProxies[componentIndex].getPiecewiseFunction();
    const colorTransferFunction = lookupTableProxy.getLookupTable();

    lookupTableProxy.setPresetName(colorMap);
    transferFunctionWidget.applyOpacity(piecewiseFunction);
    const colorDataRange = transferFunctionWidget.getOpacityRange();
    if (colorDataRange) {
      colorTransferFunction.setMappingRange(...colorDataRange);
    }
    colorTransferFunction.updateRange();
    transferFunctionWidget.render();
    store.renderWindow.render();
  };

  publicAPI.addPresetColorMap = (preset) => {
    ColorMaps.addPreset(preset);
  };

  return publicAPI;
};

export default createViewer;
