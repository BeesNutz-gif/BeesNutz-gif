
import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { Stats } from './libs/stats.module.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js'
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class App{
	constructor(){
	const container = document.createElement('div');
	document.body.appendChild(container);

	this.assetsPath = './assets/';
	
	this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000);
	this.camera.position.set(0, 1.6, 0);
	
	this.dolly = new THREE.Object3D();
	this.dolly.position.set(0, 0, 10);
	this.dolly.add(this.camera);
	this.dummyCam = new THREE.Object3D();
	this.camera.add(this.dummyCam);
	
	this.scene = new THREE.Scene();
	this.scene.add(this.dolly);
//fog
//this.scene.fog = new THREE.Fog(0xaaaaaa, 30, 120);

		//Cool Sci-Fi Tone
	const ambient = new THREE.HemisphereLight(0x88ccff, 0x222244, 1.0); 
	this.scene.add(ambient);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);	

	// === Background Music ===
	const listener = new THREE.AudioListener();
this.camera.add(listener);
const sound = new THREE.Audio(listener);
this.sound = sound; // optional: access later

const audioLoader = new THREE.AudioLoader();
audioLoader.load('music.mp3.mp3', (buffer) => {
	sound.setBuffer(buffer);
	sound.setLoop(true);
	sound.setVolume(0.3);

	const resumeAudio = () => {
		if (THREE.AudioContext.getContext().state === 'suspended') {
			THREE.AudioContext.getContext().resume();
		}
		sound.play();
		window.removeEventListener('click', resumeAudio);
	};

	window.addEventListener('click', resumeAudio);
	});

	this.renderer = new THREE.WebGLRenderer({ antialias: true });
	this.renderer.setPixelRatio(window.devicePixelRatio);
	this.renderer.setSize(window.innerWidth, window.innerHeight);
	this.renderer.outputEncoding = THREE.sRGBEncoding;
	container.appendChild(this.renderer.domElement);

	// Stats
	this.stats = new Stats();
	this.stats.dom.style.position = 'absolute';
	this.stats.dom.style.top = '0px';
	this.stats.dom.style.left = '0px';
	document.body.appendChild(this.stats.dom);

	// Resize listener
	window.addEventListener('resize', this.resize.bind(this));

	// Core variables
	this.clock = new THREE.Clock();
	this.up = new THREE.Vector3(0, 1, 0);
	this.origin = new THREE.Vector3();
	this.workingVec3 = new THREE.Vector3();
	this.workingQuaternion = new THREE.Quaternion();
	this.raycaster = new THREE.Raycaster();
	this.immersive = false;

	this.loadingBar = new LoadingBar();
	this.loadCollege();

	// Environment map
	const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
	const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
	pmremGenerator.compileEquirectangularShader();
	loader.load('./assets/hdr/venice_sunset_1k.hdr', (texture) => {
		const envMap = pmremGenerator.fromEquirectangular(texture).texture;
		pmremGenerator.dispose();
		this.scene.environment = envMap;
	}, undefined, (err) => {
		console.error('An error occurred setting the environment');
	});

	// Load info board data
	fetch('./college.json')
		.then(response => response.json())
		.then(obj => {
			this.boardShown = '';
			this.boardData = obj;
		});
}


	loadCollege(){
    const loader = new GLTFLoader().setPath(this.assetsPath);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./libs/three/js/draco/');
    loader.setDRACOLoader(dracoLoader);

    const self = this;

    loader.load(
        'college.glb',
        function (gltf) {
            const college = gltf.scene.children[0];
            self.scene.add(college);

            college.traverse(function (child) {
                if (child.isMesh){
                    if (child.name.indexOf("PROXY") !== -1){
                        child.material.visible = false;
                        self.proxy = child;
                    } else if (child.material.name.indexOf('Glass') !== -1){
                        child.material.opacity = 0.1;
                        child.material.transparent = true;
                    } else if (child.material.name.indexOf("SkyBox") !== -1){
                        const mat1 = child.material;
                        const mat2 = new THREE.MeshBasicMaterial({
                            map: mat1.map,
                            side: THREE.BackSide,
                            fog: false,
                            depthWrite: false,
                            toneMapped: true
                        });
                        child.material = mat2;
                        child.renderOrder = -1;
                        mat1.dispose();
                    }
                }
            });

           //deleted
			
			// called while loading is progressing
			function ( xhr ) {

				self.loadingBar.progress = (xhr.loaded / xhr.total);
				
			},
			// called when loading has errors
			function ( error ) {

				console.log( 'An error happened' );

			}
		);
	}
    
    setupXR(){
        this.renderer.xr.enabled = true;

        const btn = new VRButton( this.renderer );
        
        const self = this;
        
        const timeoutId = setTimeout( connectionTimeout, 2000 );
        
        function onSelectStart( event ) {
        
            this.userData.selectPressed = true;
        
        }

        function onSelectEnd( event ) {
        
            this.userData.selectPressed = false;
        
        }
        
        function onConnected( event ){
            clearTimeout( timeoutId );
        }
        
        function connectionTimeout(){
            self.useGaze = true;
            self.gazeController = new GazeController( self.scene, self.dummyCam );
        }
        
        this.controllers = this.buildControllers( this.dolly );
        
        this.controllers.forEach( ( controller ) =>{
            controller.addEventListener( 'selectstart', onSelectStart );
            controller.addEventListener( 'selectend', onSelectEnd );
            controller.addEventListener( 'connected', onConnected );
        });
        
        const config = {
            panelSize: { height: 0.5 },
            height: 256,
            name: { fontSize: 50, height: 70 },
            info: { position:{ top: 70, backgroundColor: "#ccc", fontColor:"#000" } }
        }
        const content = {
            name: "name",
            info: "info"
        }
        
        this.ui = new CanvasUI( content, config );
        this.scene.add( this.ui.mesh );
        
        this.renderer.setAnimationLoop( this.render.bind(this) );
    }
    
    buildControllers( parent = this.scene ){
        const controllerModelFactory = new XRControllerModelFactory();

        const geometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, -1 ) ] );

        const line = new THREE.Line( geometry );
        line.scale.z = 0;
        
        const controllers = [];
        
        for(let i=0; i<=1; i++){
            const controller = this.renderer.xr.getController( i );
            controller.add( line.clone() );
            controller.userData.selectPressed = false;
            parent.add( controller );
            controllers.push( controller );
            
            const grip = this.renderer.xr.getControllerGrip( i );
            grip.add( controllerModelFactory.createControllerModel( grip ) );
            parent.add( grip );
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
        //Store original dolly rotation
        const quaternion = this.dolly.quaternion.clone();
        //Get rotation for movement from the headset pose
        this.dolly.quaternion.copy( this.dummyCam.getWorldQuaternion(this.workingQuaternion) );
		this.dolly.getWorldDirection(dir);
        dir.negate();
		this.raycaster.set(pos, dir);
		
        let blocked = false;
		
		let intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            if (intersect[0].distance < wallLimit) blocked = true;
        }
		
		if (!blocked){
            this.dolly.translateZ(-dt*speed);
            pos = this.dolly.getWorldPosition( this.origin );
		}
		
        //cast left
        dir.set(-1,0,0);
        dir.applyMatrix4(this.dolly.matrix);
        dir.normalize();
        this.raycaster.set(pos, dir);

        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            if (intersect[0].distance<wallLimit) this.dolly.translateX(wallLimit-intersect[0].distance);
        }

        //cast right
        dir.set(1,0,0);
        dir.applyMatrix4(this.dolly.matrix);
        dir.normalize();
        this.raycaster.set(pos, dir);

        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            if (intersect[0].distance<wallLimit) this.dolly.translateX(intersect[0].distance-wallLimit);
        }

        //cast down
        dir.set(0,-1,0);
        pos.y += 1.5;
        this.raycaster.set(pos, dir);
        
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            this.dolly.position.copy( intersect[0].point );
        }

	// Slight head bob effect
        this.camera.position.y = 1.6 + Math.sin(performance.now() * 0.005) * 0.02;    

        //Restore the original rotation
        this.dolly.quaternion.copy( quaternion );
	}
		
    get selectPressed(){
        return ( this.controllers !== undefined && (this.controllers[0].userData.selectPressed || this.controllers[1].userData.selectPressed) );    
    }
    
    showInfoboard( name, info, pos ){
        if (this.ui === undefined ) return;
    this.ui.position.copy(pos).add( this.workingVec3.set( 0, 1.3, 0 ) );
    const camPos = this.dummyCam.getWorldPosition( this.workingVec3 );
    this.ui.updateElement( 'name', info.name );
    this.ui.updateElement( 'info', info.info );
    this.ui.update();
    this.ui.lookAt( camPos )
    this.ui.visible = true;
    this.boardShown = name;
}

resize(){
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
}

render(timestamp, frame) {
  const dt = this.clock.getDelta();

  if (this.renderer.xr.isPresenting) {
    // your VR logic here
  }

  if (this.immersive !== this.renderer.xr.isPresenting) {
    this.resize();
    this.immersive = this.renderer.xr.isPresenting;
  }

  // Get the canvas inside stats.dom — it is usually the only canvas child element
  const statsCanvas = this.stats.dom.querySelector('canvas');

  // Only update stats if the canvas is present and non-zero sized
  if (statsCanvas && statsCanvas.width > 0 && statsCanvas.height > 0) {
    this.stats.update();
  }

  // Always render your scene regardless of stats update
  this.renderer.render(this.scene, this.camera);
}
}


export { App };

