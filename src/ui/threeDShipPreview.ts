import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import type { ShipFlightPose } from '@/ui/shipFlight';
import type {
  Group,
  Mesh,
  LineLoop,
  Object3D,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three';
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
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  private readonly onAvailabilityChange: (available: boolean) => void;
  private runtime: typeof ThreeRuntime | null = null;
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: OrthographicCamera | null = null;
  private loader: OBJLoader | null = null;
  private model: Group | null = null;
  private requestedAsset: Ego3DAsset | undefined;
  private requestedTint = 0xffffff;
  private loadGeneration = 0;
  private rotation = 0;
  private flightPose: ShipFlightPose | null = null;
  private orbit: LineLoop | null = null;
  private auraVisible = false;
  private ready = false;
  private failed = false;
  private destroyed = false;
  private initialization: Promise<void> | null = null;
  private platform: Group | null = null;
  private engine: Mesh | null = null;
  private yaw = 0;
  private tilt = 0;
  private elapsed = 0;
  private appearance = { scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 };
  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    this.failed = true;
    this.canvas.style.display = 'none';
    this.onAvailabilityChange(false);
  };

  constructor(
    host: HTMLElement,
    width = 260,
    height = 180,
    onAvailabilityChange: (available: boolean) => void = () => undefined,
    private readonly hangar = false,
  ) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.host.replaceChildren(this.canvas);
    this.width = width;
    this.height = height;
    this.onAvailabilityChange = onAvailabilityChange;
    this.host.style.width = `${width}px`;
    this.host.style.height = `${height}px`;
    this.host.style.overflow = 'hidden';
    this.host.style.background = 'transparent';
    this.host.style.pointerEvents = 'none';
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.background = 'transparent';
    this.canvas.style.display = 'none';
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
  }

  rotateBy(dx: number, dy: number): void {
    this.yaw += dx * 0.012;
    this.tilt = Math.max(-0.45, Math.min(0.45, this.tilt + dy * 0.006));
  }

  resetRotation(): void {
    this.yaw = 0;
    this.tilt = 0;
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.host.style.width = this.canvas.style.width = `${this.width}px`;
    this.host.style.height = this.canvas.style.height = `${this.height}px`;
    this.renderer?.setSize(this.width, this.height, false);
    if (this.camera) {
      const viewHeight = this.hangar ? 2.8 : 2.2;
      this.camera.left = (-viewHeight * this.width) / this.height / 2;
      this.camera.right = -this.camera.left;
      this.camera.updateProjectionMatrix();
    }
  }

  setAppearance(tint: number, frame: typeof this.appearance): void {
    this.appearance = frame;
    if (this.model) this.applyTint(this.model, tint);
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

  setFlightPose(pose: ShipFlightPose): void {
    this.flightPose = pose;
  }

  setAuraVisible(visible: boolean): void {
    this.auraVisible = visible;
    if (this.orbit) this.orbit.visible = visible;
  }

  update(deltaMs: number): void {
    if (this.failed || !this.ready || this.model === null) return;
    if (this.hangar) {
      this.elapsed += Math.max(0, deltaMs);
      const frame = this.appearance;
      this.model.rotation.set(this.tilt, this.yaw + frame.rotation, 0);
      this.model.scale.set(frame.scaleX, 1, frame.scaleY);
      this.model.position.y =
        0.12 + (prefersReducedMotion() ? 0 : Math.sin(this.elapsed / 1300) * 0.035);
      this.render();
      return;
    }
    if (!prefersReducedMotion()) this.rotation += Math.max(0, deltaMs) / 5000;
    const pose = prefersReducedMotion() ? { bank: 0, pitch: 0 } : this.flightPose;
    this.model.rotation.y = pose ? -pose.bank : this.rotation;
    this.model.rotation.x = pose?.pitch ?? 0;
    this.model.rotation.z = pose ? pose.bank * 0.6 : 0;
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.loadGeneration += 1;
    this.removeModel();
    if (this.platform) this.disposeObject(this.platform);
    this.platform = null;
    if (this.orbit) {
      this.orbit.geometry.dispose();
      const materials = Array.isArray(this.orbit.material)
        ? this.orbit.material
        : [this.orbit.material];
      for (const material of materials) material.dispose();
      this.orbit = null;
    }
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.loader = null;
    this.runtime = null;
    this.ready = false;
    this.initialization = null;
    this.canvas.remove();
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
      renderer.domElement.style.width = `${this.width}px`;
      renderer.domElement.style.height = `${this.height}px`;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.pointerEvents = 'none';
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(this.width, this.height, false);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      // Die OBJ-Modelle liegen flach in der X/Z-Ebene. Die Kamera blickt
      // deshalb immer von oben entlang der Y-Achse herab (Birdseye-Ansicht).
      // Orthografisch statt perspektivisch: Die Schiffe sollen wie im Spiel
      // als klare Draufsicht gelesen werden. Damit bleibt die Silhouette bei
      // jedem Modellwechsel gleich gross und die langen Orbital-01-bis-03-
      // Rumpfflaechen verschwinden nicht durch eine schräge Perspektive.
      const viewHeight = this.hangar ? 2.8 : 2.2;
      const viewWidth = viewHeight * (this.width / this.height);
      const camera = new THREE.OrthographicCamera(
        -viewWidth / 2,
        viewWidth / 2,
        viewHeight / 2,
        -viewHeight / 2,
        0.01,
        100,
      );
      camera.position.set(0, 4, this.hangar ? 4 : 0);
      camera.up.set(0, this.hangar ? 1 : 0, this.hangar ? 0 : -1);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight(0xffffff, this.hangar ? 1.5 : 0.85));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
      keyLight.position.set(2, 3, 4);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x80aaff, 1.2);
      rimLight.position.set(-3, 1, -2);
      scene.add(rimLight);

      if (this.hangar) {
        this.platform = new THREE.Group();
        const deck = new THREE.Mesh(
          new THREE.CylinderGeometry(1.02, 1.12, 0.13, 64),
          new THREE.MeshStandardMaterial({ color: 0x172734, metalness: 0.65, roughness: 0.35 }),
        );
        deck.position.y = -0.55;
        this.platform.add(deck);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(1.02, 0.018, 8, 64),
          new THREE.MeshBasicMaterial({ color: 0xffd479 }),
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = -0.48;
        this.platform.add(rim);
        scene.add(this.platform);
      }

      // Depth testing lets the mesh hide the rear half of the decorative orbit.
      const orbitPoints = Array.from({ length: 96 }, (_, i) => {
        const angle = (i / 96) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(angle) * 0.95,
          Math.sin(angle) * 0.35,
          Math.sin(angle) * 0.31,
        );
      });
      this.orbit = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }),
      );
      this.orbit.visible = this.auraVisible;
      if (this.hangar) {
        this.orbit.rotation.x = Math.PI / 2;
        this.orbit.position.y = 0.08;
      }
      scene.add(this.orbit);
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

        this.fitModel(model);
        this.applyTint(model, this.requestedTint);
        // Rotate around the fitted centre, not the OBJ export origin.
        const pivot = new this.runtime!.Group();
        pivot.add(model);
        if (this.hangar) {
          this.engine = new this.runtime!.Mesh(
            new this.runtime!.SphereGeometry(0.1, 12, 8),
            new this.runtime!.MeshBasicMaterial({
              color: 0x9bdcff,
              transparent: true,
              opacity: 0.8,
            }),
          );
          this.engine.position.set(0, 0, 0.72);
          this.engine.scale.set(0.6, 0.5, 2.2);
          pivot.add(this.engine);
        }
        this.model = pivot;
        this.scene?.add(pivot);
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
    model.updateMatrixWorld(true);
    const box = new this.runtime.Box3().setFromObject(model);
    const size = box.getSize(new this.runtime.Vector3());
    const largest = Math.max(size.x, size.y, size.z);
    if (largest <= 0) return;

    model.scale.setScalar(1.5 / largest);
    model.updateMatrixWorld(true);
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
      const originalMaterial = mesh.material;
      const materials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
      const tintedMaterials = materials.map((material) => {
        if (material instanceof this.runtime!.MeshStandardMaterial) {
          material.color.setHex(tint);
          material.emissive.setHex(tint);
          if (this.hangar) {
            material.transparent = true;
            material.opacity = this.appearance.alpha;
          }
          return material;
        }
        if (mesh === this.engine) return material;
        material.dispose();
        return new this.runtime!.MeshStandardMaterial({
          color: tint,
          emissive: tint,
          emissiveIntensity: 0.12,
          roughness: 0.46,
          metalness: 0.28,
          flatShading: true,
          side: this.runtime!.DoubleSide,
        });
      });
      // Die OBJ-Schiffe bestehen jeweils aus einer Geometrie ohne Gruppen.
      // Ein Einzelelement muss deshalb ein einzelnes Material behalten:
      // Three.js wuerde ein Material-Array nur an Geometrie-Gruppen binden
      // und die Orbital-01-bis-03-Meshes dann komplett ueberspringen.
      if (Array.isArray(originalMaterial)) {
        mesh.material = tintedMaterials;
      } else if (tintedMaterials[0] !== undefined) {
        mesh.material = tintedMaterials[0];
      }
    });
  }

  private removeModel(): void {
    if (this.model === null) return;
    this.scene?.remove(this.model);
    this.disposeObject(this.model);
    this.model = null;
    this.engine = null;
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
