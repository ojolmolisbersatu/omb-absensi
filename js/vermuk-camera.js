let capturedImageBase64 = null;
let holdTimer = null;
let isHolding = false;
let isCaptured = false;
let cameraInstance = null;

const videoElement = document.getElementById('vermukVideo');
const resultImage = document.getElementById('vermukResult');
const canvasElement = document.getElementById('vermukCanvas');
const frameElement = document.getElementById('vermukFrame');
const feedbackElement = document.getElementById('vermukFeedback');
const actionGroup = document.getElementById('vermukActionGroup');
const btnRetake = document.getElementById('btnRetake');

const faceDetection = new FaceDetection({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
});

faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.65 });
faceDetection.onResults(onFaceResults);

function onFaceResults(results) {
  if (isCaptured) return;

  if (!results.detections || results.detections.length === 0) {
    updateStatus('red', 'Arahkan wajah ke dalam lingkaran');
    resetHoldTimer();
    return;
  }

  const boundingBox = results.detections[0].boundingBox;
  const faceSizeRatio = boundingBox.width;

  if (faceSizeRatio < 0.35) {
    updateStatus('yellow', 'Wajah terlalu jauh, mendekatlah');
    resetHoldTimer();
  } else if (faceSizeRatio > 0.70) {
    updateStatus('yellow', 'Wajah terlalu dekat, jauhkah HP');
    resetHoldTimer();
  } else {
    updateStatus('green', 'Tahan, jangan gerak-gerak dulu...');
    startHoldTimer();
  }
}

function updateStatus(color, message) {
  frameElement.className = `vermuk-frame status-${color}`;
  feedbackElement.className = `vermuk-feedback status-text-${color}`;
  feedbackElement.innerText = message;
}

function startHoldTimer() {
  if (isHolding) return;
  isHolding = true;
  holdTimer = setTimeout(() => { takeSnapshot(); }, 1000);
}

function resetHoldTimer() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  isHolding = false;
}

function takeSnapshot() {
  isCaptured = true;
  resetHoldTimer();

  const ctx = canvasElement.getContext('2d');
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  ctx.translate(canvasElement.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  capturedImageBase64 = canvasElement.toDataURL('image/jpeg', 0.85);

  resultImage.src = capturedImageBase64;
  resultImage.style.display = 'block';
  videoElement.style.display = 'none';

  updateStatus('green', 'Foto Berhasil Diambil!');
  actionGroup.style.display = 'block';

  if (cameraInstance) { cameraInstance.stop(); }
}

btnRetake.addEventListener('click', () => {
  isCaptured = false;
  capturedImageBase64 = null;
  resultImage.style.display = 'none';
  videoElement.style.display = 'block';
  actionGroup.style.display = 'none';
  updateStatus('red', 'Memulai ulang kamera...');
  startCamera();
});

function startCamera() {
  cameraInstance = new Camera(videoElement, {
    onFrame: async () => {
      if (!isCaptured) { await faceDetection.send({ image: videoElement }); }
    },
    width: 640,
    height: 480,
    facingMode: 'user'
  });
  cameraInstance.start();
}

document.addEventListener('DOMContentLoaded', () => { startCamera(); });
