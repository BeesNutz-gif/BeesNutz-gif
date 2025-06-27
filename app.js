import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.assetsPath = './assets/';

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 500);
        this.camera.position.set(0, 1.6, 0);

        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, 0, 10);
        this.dolly.add(this.camera);
        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        this.scene = new THREE.Scene();
        this.scene.add(this.dolly);

        const ambient = new THREE.HemisphereLight(0xFFFFFF, 0xAAAAAA, 0.8);
        this.scene.add(ambient);

        const listener = new THREE.AudioListener();
        this.camera.add(listener);

        const sound = new THREE.Audio(listener);
        const audioLoader = new THREE.AudioLoader();

        audioLoader.load('music.mp3.mp3', (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(0.3);
        });

        document.body.addEventListener('click', () => {
            if (!sound.isPlaying) sound.play();
        });

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        this.setEnvironment();
        this.setupBoundary();

        window.addEventListener('resize', this.resize.bind(this));

        this.clock = new THREE.Clock();
        this.up = new THREE.Vector3(0, 1, 0);
        this.origin = new THREE.Vector3();
        this.workingVec3 = new THREE.Vector3();
        this.workingQuaternion = new THREE.Quaternion();
        this.raycaster = new THREE.Raycaster();

        this.loadingBar = new LoadingBar();
        this.loadCollege();

        this.immersive = false;

        fetch('./college.json')
            .then(response => response.json())
            .then(obj => {
                this.boardShown = '';
                this.boardData = obj;
            });
    }

    setEnvironment() {
        const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        loader.load('./assets/hdr/new_sky.hdr', (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();
            this.scene.environment = envMap;
            this.scene.background = envMap;
        }, undefined, (err) => {
            console.error('❌ HDR failed to load:', err);
        });
    }

    setupBoundary() {
        this.BOUNDARY_RADIUS = 100;
        const boundaryBox = new THREE.Mesh(
            new THREE.BoxGeometry(this.BOUNDARY_RADIUS * 2, 5, this.BOUNDARY_RADIUS * 2),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        boundaryBox.position.y = 2.5;
        this.scene.add(boundaryBox);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    loadCollege() {
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./libs/three/js/draco/');
        loader.setDRACOLoader(dracoLoader);

        loader.load('college.glb', (gltf) => {
            const college = gltf.scene.children[0];
            this.scene.add(college);

            college.traverse((child) => {
                if (child.isMesh) {
                    const meshName = child.name.toLowerCase();
                    const matName = child.material.name.toLowerCase();

                    if (child.name.indexOf("PROXY") !== -1) {
                        child.material.visible = false;
                        this.proxy = child;
                    } else if (matName.includes("glass")) {
                        child.material.opacity = 0.1;
                        child.material.transparent = true;
                    } else if (
                        (meshName.includes("sky") || meshName.includes("dome") || meshName.includes("background")) &&
                        (matName.includes("sky") || matName.includes("dome") || matName.includes("background"))
                    ) {
                        child.visible = false;
                    }
                }
            });

            this.loadingBar.visible = false;
            this.setupXR();
        }, xhr => {
            this.loadingBar.progress = (xhr.loaded / xhr.total);
        }, error => {
            console.log('An error happened', error);
        });
    }

    setupXR() {
        this.renderer.xr.enabled = true;
        const btn = new VRButton(this.renderer);

        const timeoutId = setTimeout(() => {
            this.useGaze = true;
            this.gazeController = new GazeController(this.scene, this.dummyCam);
        }, 2000);

        this.controllers = this.buildControllers(this.dolly);
        this.controllers.forEach((controller) => {
            controller.addEventListener('selectstart', () => controller.userData.selectPressed = true);
            controller.addEventListener('selectend', () => controller.userData.selectPressed = false);
        });

        const config = {
            panelSize: { height: 0.5 },
            height: 256,
            name: { fontSize: 50, height: 70 },
            info: { position: { top: 70, backgroundColor: "#ccc", fontColor: "#000" } }
        };
        const content = { name: "name", info: "info" };

        this.ui = new CanvasUI(content, config);
        this.scene.add(this.ui.mesh);

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    buildControllers(parent = this.scene) {
        const controllerModelFactory = new XRControllerModelFactory();
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const line = new THREE.Line(geometry);
        line.scale.z = 0;

        const controllers = [];
        for (let i = 0; i <= 1; i++) {
            const controller = this.renderer.xr.getController(i);
            controller.add(line.clone());
            controller.userData.selectPressed = false;
            parent.add(controller);
            controllers.push(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            parent.add(grip);
        }
        return controllers;
    }

    get selectPressed() {
        return this.controllers?.some(ctrl => ctrl.userData.selectPressed);
    }

    render() {
        const dt = this.clock.getDelta();

        if (this.renderer.xr.isPresenting) {
            const dollyPos = this.dolly.getWorldPosition(new THREE.Vector3());
            const distance = dollyPos.length();
            if (distance > this.BOUNDARY_RADIUS) {
                console.warn("🌀 You left the map! Teleporting back...");
                this.dolly.position.set(0, 1.6, 0);
                this.dolly.rotation.set(0, 0, 0);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

export { App };
