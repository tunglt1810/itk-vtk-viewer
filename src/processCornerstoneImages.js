// import createWebworkerPromise from 'itk/createWebworkerPromise';
// import config from 'itk/itkConfig';
import vtkITKHelper from 'vtk.js/Sources/Common/DataModel/ITKHelper';
import readImageHTTP from 'itk/readImageHTTP';
import createViewer from './createViewer';

// const processCornerstoneImages = (container, { files: fileDescriptions, use2D }) => {
//   console.log('start process cornerstone images');
//   let usedWorker;
//   createWebworkerPromise('ImageIO', null)
//     .then((_ref) => {
//       const { webworkerPromise } = _ref;
//       usedWorker = _ref.worker;
//
//       const transferables = Array.from(fileDescriptions, file => file.data);
//       console.log('file descriptions', fileDescriptions);
//       console.log('transferables', transferables);
//       return webworkerPromise.postMessage({
//         operation: 'readDICOMImageSeries',
//         fileDescriptions,
//         config
//       }, transferables);
//     })
//     .then((image) => {
//       console.log('process result', image);
//       usedWorker.terminate();
//
//       const imageData = vtkITKHelper.convertItkToVtkImage(image);
//       const is3D = image.imageType.dimension === 3 && !use2D;
//       createViewer(container, {
//         image: imageData,
//         use2D: !is3D,
//       });
//     })
//     .catch((error) => {
//       console.error(error);
//     });
// };

const processCornerstoneImages = (container, url, configViewport) => new Promise((resolve, reject) => {
  readImageHTTP(url)
    .then((itkImage) => {
      const imageData = vtkITKHelper.convertItkToVtkImage(itkImage);
      resolve(
        createViewer(container, {
          image: imageData,
          use2D: false,
          ...configViewport
        })
      );
    });
});

export default processCornerstoneImages;
