Toast.init();
Modal.init();
ScorePad.init();
Debug.init();
State.init();
// 显示版本号
const versionEl = document.getElementById('menuVersion');
if (versionEl) {
    const versionText = versionEl.textContent;
    if (versionText) {
        Toast.show(versionText);
    }
}
