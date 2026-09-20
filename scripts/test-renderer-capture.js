import { app, BrowserWindow, desktopCapturer } from 'electron';

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.resolve('dist/index.html'));

  win.webContents.once('did-finish-load', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      console.log('Got sources in main:', sources.map(s => s.id));
      const sourceId = sources[0].id;

      // Execute capture inside renderer via getUserMedia
      const result = await win.webContents.executeJavaScript(`
        new Promise(async (resolve, reject) => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: '${sourceId}',
                  minWidth: 1280,
                  maxWidth: 1920,
                  minHeight: 720,
                  maxHeight: 1080
                }
              }
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            video.onloadedmetadata = async () => {
              await video.play();
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              stream.getTracks().forEach(t => t.stop());
              resolve({
                width: canvas.width,
                height: canvas.height,
                dataUrlLength: dataUrl.length,
                preview: dataUrl.slice(0, 50)
              });
            };
          } catch (err) {
            reject(err.message);
          }
        });
      `);

      console.log('Renderer capture SUCCESS:', result);
    } catch (err) {
      console.error('Renderer capture FAILED:', err);
    } finally {
      app.quit();
    }
  });
});
