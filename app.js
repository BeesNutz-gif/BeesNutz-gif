import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App{
	constructor(){
		const container = document.createElement( 'div' );
		document.body.appendChild( container );

		this.assetsPath = './assets/';

		this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 500 );
		this.camera.position.set( 0, 1.6, 0 );

        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, 0, 10);
        this.dolly.add( this.camera );
        this.dummyCam = new THREE.Object3D();
        this.camera.add( this.dummyCam );

		this.scene = new THREE.Scene();
		this.scene.background = null; // Kill fallback background

        this.scene.add( this.dolly );

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
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		container.appendChild( this.renderer.domElement );
        this.setEnvironment();

        window.addEventListener( 'resize', this.resize.bind(this) );

        this.clock = new THREE.Clock();
        this.up = new THREE.Vector3(0,1,0);
        this.origin = new THREE.Vector3();
        this.workingVec3 = new THREE.Vector3();
        this.workingQuaternion = new THREE.Quaternion();
        this.raycaster = new THREE.Raycaster();

		this.loadingBar = new LoadingBar();
		this.loadCollege();
        this.immersive = false;
        const self = this;
        fetch('./college.json')
            .then(response => response.json())
            .then(obj =>{
                self.boardShown = '';
                self.boardData = obj;
            });
	}

   setEnvironment(){
    this.scene.environment = null;
    this.scene.background = null;


}

	loadCollege(){
	const loader = new GLTFLoader().setPath(this.assetsPath);
	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath('./libs/three/js/draco/');
	loader.setDRACOLoader(dracoLoader);

	const self = this;
	loader.load('college.glb', function (gltf) {
		const college = gltf.scene.children[0];

		// ☢️ Hard remove any sky/dome/background object
		college.traverse(obj => {
			const name = obj.name.toLowerCase();
			if (name.includes("sky") || name.includes("dome") || name.includes("background")) {
				console.warn(`⚠️ Removing possible sky object: ${obj.name}`);
				if (obj.parent) obj.parent.remove(obj);
			}
		});

		// Optional: confirm what's still in the scene
		college.traverse(obj => console.log(`[${obj.type}] ${obj.name} | visible: ${obj.visible}`));

		self.scene.add(college);

		college.traverse(function (child) {
			if (child.isMesh) {
				const meshName = child.name.toLowerCase();
				const matName = child.material.name.toLowerCase();

				if (child.name.indexOf("PROXY") != -1) {
					child.material.visible = false;
					self.proxy = child;

				} else if (matName.includes("glass")) {
					child.material.opacity = 0.1;
					child.material.transparent = true;

				} else if (
					(meshName.includes("sky") || meshName.includes("dome") || meshName.includes("background")) &&
					(matName.includes("sky") || matName.includes("dome") || matName.includes("background"))
				) {
					child.visible = false; // Shouldn't matter anymore, but just in case
				}
			}
		});

		const door1 = college.getObjectByName("LobbyShop_Door__1_");
		const door2 = college.getObjectByName("LobbyShop_Door__2_");
		const pos = door1.position.clone().sub(door2.position).multiplyScalar(0.5).add(door2.position);
		const obj = new THREE.Object3D();
		obj.name = "LobbyShop";
		obj.position.copy(pos);
		college.add(obj);

		// 🚫 Add invisible wall
		const doorBlock = new THREE.Mesh(
			new THREE.BoxGeometry(2, 2, 0.2),
			new THREE.MeshBasicMaterial({ visible: false })
		);
		doorBlock.position.set(1, 1, -3); // Adjust as needed
		doorBlock.name = "NoEntryWall";
		self.scene.add(doorBlock);
		self.proxy = doorBlock;

		self.loadingBar.visible = false;
		self.setupXR();

	}, function (xhr) {
		self.loadingBar.progress = (xhr.loaded / xhr.total);
	}, function (error) {
		console.log('An error happened');
	});
}


            const door1 = college.getObjectByName("LobbyShop_Door__1_");
            const door2 = college.getObjectByName("LobbyShop_Door__2_");
            const pos = door1.position.clone().sub(door2.position).multiplyScalar(0.5).add(door2.position);
            const obj = new THREE.Object3D();
            obj.name = "LobbyShop";
            obj.position.copy(pos);
            college.add(obj);

            // 🚫 Add invisible wall
            const doorBlock = new THREE.Mesh(
              new THREE.BoxGeometry(2, 2, 0.2),
              new THREE.MeshBasicMaterial({ visible: false })
            );
            doorBlock.position.set(1, 1, -3); // Change to match entrance
            doorBlock.name = "NoEntryWall";
            self.scene.add(doorBlock);
            self.proxy = doorBlock;

            self.loadingBar.visible = false;
            self.setupXR();
		}, function ( xhr ) {
			self.loadingBar.progress = (xhr.loaded / xhr.total);
		}, function ( error ) {
			console.log( 'An error happened' );
		});
	}

    setupXR(){
        this.renderer.xr.enabled = true;
        const btn = new VRButton( this.renderer );
        const self = this;
        const timeoutId = setTimeout(() => self.useGaze = true, 2000);

        const onSelectStart = function () { this.userData.selectPressed = true; };
        const onSelectEnd = function () { this.userData.selectPressed = false; };
        const onConnected = function () { clearTimeout(timeoutId); };

        this.controllers = this.buildControllers(this.dolly);
        this.controllers.forEach((controller) => {
            controller.addEventListener('selectstart', onSelectStart);
            controller.addEventListener('selectend', onSelectEnd);
            controller.addEventListener('connected', onConnected);
        });

        const config = {
            panelSize: { height: 0.5 },
            height: 256,
            name: { fontSize: 50, height: 70 },
            info: { position:{ top: 70, backgroundColor: "#ccc", fontColor:"#000" } }
        };
        const content = { name: "name", info: "info" };

        this.ui = new CanvasUI(content, config);
        this.scene.add(this.ui.mesh);

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    buildControllers(parent = this.scene){
        const controllerModelFactory = new XRControllerModelFactory();
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const line = new THREE.Line(geometry);
        line.scale.z = 0;
        const controllers = [];

        for(let i=0; i<=1; i++){
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

    moveDolly(dt){
        if (this.proxy === undefined) return;
        const wallLimit = 1.3;
        const speed = 2;
		let pos = this.dolly.position.clone();
        pos.y += 1;
		let dir = new THREE.Vector3();
        const quaternion = this.dolly.quaternion.clone();
        this.dolly.quaternion.copy(this.dummyCam.getWorldQuaternion(this.workingQuaternion));
		this.dolly.getWorldDirection(dir);
        dir.negate();
		this.raycaster.set(pos, dir);
		let blocked = false;
		let intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0 && intersect[0].distance < wallLimit) blocked = true;
		if (!blocked){
            this.dolly.translateZ(-dt*speed);
            pos = this.dolly.getWorldPosition(this.origin);
		}
        dir.set(-1,0,0);
        dir.applyMatrix4(this.dolly.matrix).normalize();
        this.raycaster.set(pos, dir);
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0 && intersect[0].distance<wallLimit) this.dolly.translateX(wallLimit-intersect[0].distance);
        dir.set(1,0,0);
        dir.applyMatrix4(this.dolly.matrix).normalize();
        this.raycaster.set(pos, dir);
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0 && intersect[0].distance<wallLimit) this.dolly.translateX(intersect[0].distance-wallLimit);
        dir.set(0,-1,0);
        pos.y += 1.5;
        this.raycaster.set(pos, dir);
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0) this.dolly.position.copy(intersect[0].point);
        this.dolly.quaternion.copy(quaternion);
	}

    get selectPressed(){
        return ( this.controllers !== undefined && (this.controllers[0].userData.selectPressed || this.controllers[1].userData.selectPressed) );    
    }

    showInfoboard(name, info, pos){
        if (this.ui === undefined) return;
        this.ui.position.copy(pos).add(new THREE.Vector3(0, 1.3, 0));
        const camPos = this.dummyCam.getWorldPosition(new THREE.Vector3());
        this.ui.updateElement('name', info.name);
        this.ui.updateElement('info', info.info);
        this.ui.update();
        this.ui.lookAt(camPos);
        this.ui.visible = true;
        this.boardShown = name;
    }

	render(timestamp, frame){
        const dt = this.clock.getDelta();
        if (this.renderer.xr.isPresenting){
            let moveGaze = false;
            if ( this.useGaze && this.gazeController!==undefined){
                this.gazeController.update();
                moveGaze = (this.gazeController.mode == GazeController.Modes.MOVE);
            }
            if (this.selectPressed || moveGaze){
                this.moveDolly(dt);
                const dollyPos = this.dolly.getWorldPosition(new THREE.Vector3());
                const door = this.scene.getObjectByName("NoEntryWall");
                if (door && dollyPos.distanceTo(door.position) < 2) {
                    this.ui.position.copy(door.position).add(new THREE.Vector3(0, 1.5, 0));
                    this.ui.updateElement("name", "🚫 No Entry");
                    this.ui.updateElement("info", "You can't go out this way.");
                    this.ui.update();
                    this.ui.lookAt(this.dummyCam.getWorldPosition(new THREE.Vector3()));
                    this.ui.visible = true;
                } else if (this.boardShown === "") {
                    this.ui.visible = false;
                }
                if (this.boardData){
                    const scene = this.scene;
                    let boardFound = false;
                    Object.entries(this.boardData).forEach(([name, info]) => {
                        const obj = scene.getObjectByName(name);
                        if (obj !== undefined){
                            const pos = obj.getWorldPosition(new THREE.Vector3());
                            if (dollyPos.distanceTo(pos) < 3){
                                boardFound = true;
                                if (this.boardShown !== name) this.showInfoboard(name, info, pos);
                            }
                        }
                    });
                    if (!boardFound && this.boardShown !== ""){
                        this.boardShown = "";
                        this.ui.visible = false;
                    }
                }
            }
        }
        if ( this.immersive != this.renderer.xr.isPresenting){
            this.resize();
            this.immersive = this.renderer.xr.isPresenting;
        }
		console.log("scene.background:", this.scene.background);
		this.renderer.render(this.scene, this.camera);
	}
}

export { App };
