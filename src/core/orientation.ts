/**
 * Portrait-Ausrichtung fuer mobile Browser anfordern.
 *
 * `orientation: portrait` im Manifest greift bei der installierten PWA. Die
 * Screen-Orientation-API hilft zusaetzlich auf Android, kann aber je nach
 * Browser nur aus Vollbild oder nach einer Benutzeraktion sperren. iOS Safari
 * stellt diese API fuer normale Webseiten nicht bereit; dort sorgt die
 * Landscape-Fallback-Anzeige in index.html dafuer, dass das Spiel nicht
 * seitlich weiterlaeuft.
 */
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'portrait') => Promise<void>;
};

export function requestPortraitOrientationLock(): void {
  const orientation = window.screen.orientation as LockableScreenOrientation;
  const lock = orientation?.lock;
  if (!lock) return;

  const attempt = (): void => {
    void lock.call(orientation, 'portrait').catch(() => {
      // Die erste Anfrage darf ohne Benutzeraktion abgelehnt werden. Ein
      // zweiter Versuch beim ersten Tipp ist auf mobilen Browsern erlaubt.
      window.addEventListener('pointerdown', attempt, { once: true, passive: true });
    });
  };

  attempt();
}
