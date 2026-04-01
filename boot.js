Toast.init();
Modal.init();
ScorePad.init();
State.init();
// 延迟显示版本号，让数据加载完成后再显示
setTimeout(() => {
    const versionEl = document.getElementById('menuVersion');
    if (versionEl) {
        const versionText = versionEl.textContent;
        if (versionText) {
            Toast.show(versionText);
        }
    }
}, 500);
