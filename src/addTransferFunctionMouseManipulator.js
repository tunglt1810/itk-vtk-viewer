import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';

const addTransferFunctionMouseManipulator = (store) => {
  const transferFunctionWidget = store.imageUI.transferFunctionWidget;

  const rangeManipulator = vtkMouseRangeManipulator.newInstance({
    button: 1
  });

  const windowMotionScale = 150.0;
  const windowGet = () => {
    const gaussian = transferFunctionWidget.getGaussians()[0];
    return gaussian.width * windowMotionScale;
  };
  const windowSet = (value) => {
    const gaussians = transferFunctionWidget.getGaussians();
    const newGaussians = gaussians.slice();
    newGaussians[0].width = value / windowMotionScale;
    store.imageUI.opacityGaussians[store.imageUI.selectedComponentIndex] = newGaussians;
    transferFunctionWidget.setGaussians(newGaussians);
  };
  rangeManipulator.setVerticalListener(
    0,
    windowMotionScale,
    1,
    windowGet,
    windowSet
  );

  // Level
  const levelMotionScale = 150.0;
  const levelGet = () => {
    const gaussian = transferFunctionWidget.getGaussians()[0];
    return gaussian.position * levelMotionScale;
  };
  const levelSet = (value) => {
    const gaussians = transferFunctionWidget.getGaussians();
    const newGaussians = gaussians.slice();
    newGaussians[0].position = value / levelMotionScale;
    store.imageUI.opacityGaussians[store.imageUI.selectedComponentIndex] = newGaussians;
    transferFunctionWidget.setGaussians(newGaussians);
  };
  rangeManipulator.setHorizontalListener(
    0,
    levelMotionScale,
    1,
    levelGet,
    levelSet
  );

  console.log('add mouse manipulator', rangeManipulator);
  store.itkVtkView.getInteractorStyle2D().addMouseManipulator(rangeManipulator);
  store.itkVtkView.getInteractorStyle3D().addMouseManipulator(rangeManipulator);
};

export default addTransferFunctionMouseManipulator;
