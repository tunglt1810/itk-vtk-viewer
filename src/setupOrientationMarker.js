import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkConeSource from 'vtk.js/Sources/Filters/Sources/ConeSource';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkOrientationMarkerWidget from 'vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget';
import vtkAnnotatedCubeActor from 'vtk.js/Sources/Rendering/Core/AnnotatedCubeActor';

const setupOrientationMarker = (model) => {
  const renderer = model.renderer;
  const renderWindow = model.renderWindow;

  // create cone
  const coneSource = vtkConeSource.newInstance();
  const actor = vtkActor.newInstance();
  const mapper = vtkMapper.newInstance();

  actor.setMapper(mapper);
  mapper.setInputConnection(coneSource.getOutputPort());

  renderer.addActor(actor);

  // create axes
  const axes = vtkAnnotatedCubeActor.newInstance();
  axes.setDefaultStyle({
    text: 'L',
    fontStyle: 'bold',
    fontFamily: 'Arial',
    // fontColor: 'black',
    // fontSizeScale: res => res / 2,
    faceColor: '#0000ff',
    fontColor: '#ffffff',
    faceRotation: 90,
    edgeThickness: 0,
    // edgeColor: 'black',
    // resolution: 400,
  });
  // axes.setXPlusFaceProperty({ text: '+X' });
  axes.setXMinusFaceProperty({
    text: 'R',
    faceColor: '#0000ff',
    fontColor: '#ffffff',
    faceRotation: -90,
    edgeThickness: 0
  });
  axes.setYPlusFaceProperty({
    text: 'P',
    faceColor: '#ff0000',
    fontColor: '#ffffff',
    faceRotation: 180,
    edgeThickness: 0
  });
  axes.setYMinusFaceProperty({
    text: 'A',
    faceColor: '#ff0000',
    fontColor: '#ffffff',
    faceRotation: 0,
    edgeThickness: 0
  });
  axes.setZPlusFaceProperty({
    text: 'S',
    faceColor: '#00ff00',
    fontColor: '#ffffff',
    faceRotation: 0,
    edgeThickness: 0
    // edgeColor: 'yellow',
  });
  axes.setZMinusFaceProperty({
    text: 'I',
    faceColor: '#00ff00',
    fontColor: '#ffffff',
    faceRotation: 0,
    edgeThickness: 0
  });

  // create orientation widget
  const orientationWidget = vtkOrientationMarkerWidget.newInstance({
    actor: axes,
    interactor: renderWindow.getInteractor(),
  });
  orientationWidget.setEnabled(true);
  orientationWidget.setViewportCorner(
    vtkOrientationMarkerWidget.Corners.TOP_RIGHT
  );
  orientationWidget.setViewportSize(0.15);
  orientationWidget.setMinPixelSize(50);
  orientationWidget.setMaxPixelSize(80);
};

export default setupOrientationMarker;
