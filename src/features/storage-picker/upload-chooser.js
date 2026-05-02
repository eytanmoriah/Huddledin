// Upload source chooser — shown before any attach.
// Two large tap targets: "From my device" and "From my Huddledin storage".

export function showUploadChooser({ onPickDevice, onPickStorage }) {
  const H = window.HUD || {};
  const { openModal, mkBtn } = H;
  if (!openModal || !mkBtn) {
    onPickDevice?.();
    return;
  }
  openModal('Attach a file', (mb, close) => {
    mb.style.display = 'flex';
    mb.style.flexDirection = 'column';
    mb.style.gap = '10px';

    let isClosing = false;
    const guard = (fn) => () => {
      if (isClosing) return;
      isClosing = true;
      close();
      fn?.();
    };

    const deviceBtn = mkBtn('', 'btn-md btn-primary btn-full', guard(onPickDevice));
    deviceBtn.innerHTML = '<span style="font-size:1.1rem">📱</span>&nbsp;&nbsp;From my device';
    deviceBtn.style.padding = '14px';
    deviceBtn.style.fontSize = '0.92rem';
    mb.appendChild(deviceBtn);

    const storageBtn = mkBtn('', 'btn-md btn-secondary btn-full', guard(onPickStorage));
    storageBtn.innerHTML = '<span style="font-size:1.1rem">🗂️</span>&nbsp;&nbsp;From my Huddledin storage';
    storageBtn.style.padding = '14px';
    storageBtn.style.fontSize = '0.92rem';
    mb.appendChild(storageBtn);
  }, 360);
}
