/**
 * タッチ端末でブラウザ標準のジェスチャーがアプリ操作と干渉しないようにする。
 * CSS（touch-action / overscroll-behavior）で効かない環境向けの補完。
 */
export function installTouchGuard(canvas) {
  const stop = (e) => e.preventDefault();

  // iOS Safari のページ全体ピンチ拡大（gesture* イベント）
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(t, stop, { passive: false });
  }

  // 3Dビューの長押しでコンテキストメニューが出るのを防ぐ
  canvas.addEventListener('contextmenu', stop);
  document.addEventListener('dragstart', stop);

  // 2本指以上のタッチがスクロール領域外でページを動かさないようにする
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 && !e.target.closest?.('.p-body')) e.preventDefault();
  }, { passive: false });
}
