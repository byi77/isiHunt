import type { Group, Mesh, Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type * as ThreeRuntime from 'three';

import type { Ego3DAsset } from '@/ui/egoAssets';

/**
 * Lazy 3D-Preview fuer den Shop.
 *
 * Three.js und die OBJ-Datei werden erst geladen, wenn wirklich eine 3D-Form
 * angeprobt wird. Der Game-Run bleibt damit beim bestehenden Phaser-2D-Pfad;
 * Im Solo-Run wird dieselbe Schicht als optionale Spielerdarstellung genutzt;
 * Hitbox, Bewegung und Gameplay bleiben in Phaser. Ein fehlendes WebGL, ein
 * langsames Netz oder ein kaputtes Modell blendet nur die 3D-Schicht aus und
 * laesst die 2D-Fallback-Silhouette sichtbar.
 */
export class ThreeDShipPreview {
  private readonly canvas: HTMLCanvasElement;
  private readonly width: number;
  private readonly height: number;
  private readonly onAvailabilityChange: (available: boolean) => void;
  private runtime: typeof ThreeRuntime | null = null;
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private loader: OBJLoader | null = null;
  private model: Group | null = null;
  private requestedAsset: Ego3DAsset | undefined;
  private requestedTint = 0xffffff;
  private loadGeneration = 0;
  private rotation = 0;
  private ready = false;
  private failed = false;
  private destroyed = false;
  private initialization: Promise<void> | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    width = 260,
    height = 180,
    onAvailabilityChange: (available: boolean) => void = () => undefined,
  ) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.onAvailabilityChange = onAvailabilityChange;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.background = 'transparent';
    this.canvas.style.display = 'none';
  }

  setModel(asset: Ego3DAsset | undefined, tint: number): void {
    const previousAssetId = this.requestedAsset?.id;
    this.requestedAsset = asset;
    this.requestedTint = tint;

    if (asset === undefined) {
      // Auch eine laufende OBJ-Anfrage muss ungültig werden. Nur die
      // Asset-ID zu prüfen reicht nicht als Zustandsmodell: Beim Wechsel auf
      // eine reine 2D-Form darf kein alter Renderer-Callback mehr sichtbar
      // schalten.
      this.loadGeneration += 1;
      this.canvas.style.display = 'none';
      this.onAvailabilityChange(false);
      this.removeModel();
      return;
    }

    if (!this.ready && !this.failed) {
      this.canvas.style.display = 'none';
      this.onAvailabilityChange(false);
      this.ensureInitialized();
      return;
    }

    if (this.failed) {
      this.canvas.style.display = 'none';
      this.onAvailabilityChange(false);
      return;
    }

    if (this.model !== null && previousAssetId === asset.id) {
      this.applyTint(this.model, tint);
      this.canvas.style.display = 'block';
      this.onAvailabilityChange(true);
      this.render();
      return;
    }

    this.loadModel(asset);
  }

  update(deltaMs: number): void {
    if (!this.ready || this.model === null) return;
    this.rotation += deltaMs / 5000;
    this.model.rotation.y = this.rotation;
    this.model.rotation.x = 0;
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    this.loadGeneration += 1;
    this.removeModel();
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.loader = null;
    this.runtime = null;
    this.ready = false;
    this.initialization = null;
    this.canvas.style.display = 'none';
    this.onAvailabilityChange(false);
  }

  private ensureInitialized(): void {
    if (this.initialization !== null) return;
    this.initialization = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const THREE = await import('three');
      const { OBJLoader: Loader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      if (this.destroyed) return;
      const renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(this.width, this.height, false);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      // Die OBJ-Modelle liegen flach in der X/Z-Ebene. Die Kamera blickt
      // deshalb immer von oben entlang der Y-Achse herab (Birdseye-Ansicht).
      const camera = new THREE.PerspectiveCamera(28, this.width / this.height, 0.01, 100);
      camera.position.set(0, 3.6, 0.01);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 1.5));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
      keyLight.position.set(2, 3, 4);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x80aaff, 1.2);
      rimLight.position.set(-3, 1, -2);
      scene.add(rimLight);

      this.runtime = THREE;
      this.renderer = renderer;
      this.scene = scene;
      this.camera = camera;
      this.loader = new Loader();
      this.ready = true;

      if (this.requestedAsset !== undefined) this.loadModel(this.requestedAsset);
    } catch {
      if (this.destroyed) return;
      this.failed = true;
      this.canvas.style.display = 'none';
      this.onAvailabilityChange(false);
    }
  }

  private loadModel(asset: Ego3DAsset): void {
    if (this.loader === null || this.scene === null || this.runtime === null) return;

    const generation = ++this.loadGeneration;
    // Waehrend des Modellwechsels bleibt kein altes 3D-Bild als scheinbar
    // ausgewaehlte Form stehen. Der 2D-Fallback darf diese kurze Ladephase
    // uebernehmen, bis das neue Modell tatsaechlich gerendert werden kann.
    this.canvas.style.display = 'none';
    this.onAvailabilityChange(false);
    this.removeModel();
    this.loader.load(
      asset.modelUrl,
      (model) => {
        if (generation !== this.loadGeneration || this.requestedAsset?.id !== asset.id) {
          this.disposeObject(model);
          return;
        }

        this.model = model;
        this.fitModel(model);
        this.applyTint(model, this.requestedTint);
        model.rotation.x = 0;
        this.scene?.add(model);
        this.canvas.style.display = 'block';
        this.onAvailabilityChange(true);
        this.render();
      },
      undefined,
      () => {
        if (generation === this.loadGeneration) {
          this.canvas.style.display = 'none';
          this.onAvailabilityChange(false);
        }
      },
    );
  }

  private fitModel(model: Group): void {
    if (this.runtime === null) return;
    const box = new this.runtime.Box3().setFromObject(model);
    const size = box.getSize(new this.runtime.Vector3());
    const largest = Math.max(size.x, size.y, size.z);
    if (largest <= 0) return;

    model.scale.setScalar(1.55 / largest);
    const centered = new this.runtime.Box3()
      .setFromObject(model)
      .getCenter(new this.runtime.Vector3());
    model.position.sub(centered);
  }

  private applyTint(model: Object3D, tint: number): void {
    if (this.runtime === null) return;
    model.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = materials.map((material) => {
        material.dispose();
        return new this.runtime!.MeshStandardMaterial({
          color: tint,
          roughness: 0.46,
          metalness: 0.28,
          flatShading: true,
        });
      });
    });
  }

  private removeModel(): void {
    if (this.model === null) return;
    this.scene?.remove(this.model);
    this.disposeObject(this.model);
    this.model = null;
  }

  private disposeObject(object: Object3D): void {
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    });
  }

  private render(): void {
    if (this.renderer === null || this.scene === null || this.camera === null) return;
    this.renderer.render(this.scene, this.camera);
  }
}
