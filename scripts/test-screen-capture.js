import { app, desktopCapturer, screen } from 'electron';

app.whenReady().then(async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    console.log('Primary display size:', width, height);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width), height: Math.round(height) },
    });

    console.log('Desktop capturer sources found:', sources.length);
    for (const s of sources) {
      console.log(`Source id: ${s.id}, name: ${s.name}`);
      const dataUrl = s.thumbnail.toDataURL();
      console.log(`Thumbnail empty: ${s.thumbnail.isEmpty()}, dataURL length: ${dataUrl.length}`);
    }
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    app.quit();
  }
});
