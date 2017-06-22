//	Idea: ability to create a thumbnail from the viewer
//	Ref: http://stackoverflow.com/questions/26193702/three-js-how-can-i-make-a-2d-snapshot-of-a-scene-as-a-jpg-image

(function(win){

var marbleready = "marbleready",
	//	Basic data-set helper
	dataset = function(el, key, value){
		var dashToCamel = function(name){
			return name.replace(/-./g, function (str) {
				return str.charAt(1).toUpperCase();
			});
		};

		if(key && typeof value !== undefined) {
			return el.setAttribute('data-' + key.toLowerCase(), value);
		} else if(key) {
			return el.getAttribute('data-' + key.toLowerCase());
		} else if(el){
			var attribs = Array.prototype.slice.call(el.attributes),
				result = {};

			//	Get all data- attributes
			for(var i = 0; i < attribs.length; i += 1) {
				var n = attribs[i].name;
				if(n.indexOf('data-') === 0) {
					var name = n.substr(5);
					result[name] = attribs[i].value;
					if(name.indexOf("-") !== -1) {
						//	Add camel cased as well
						result[dashToCamel(name)] = attribs[i].value;
					}
				}
			}
			return result;
		}
	};


//	We always create a singleton - this allows us to keep track of all instances of image players - we can use this to pause rendering, if another image on the page is already rendering.
if(!win.marble) {
	win.marble = {
		pubSub: new ulib.Pubsub()
	};
	win.marble.pubSub.addEventType({
		type: 'isActive'
	});

	win.marble.destroy = function(el) {
		//	Remove data attribs!
		el.removeAttribute("data-" + marbleready);
		el.removeAttribute("data-img");
		el.innerHTML = "";
	};

	//	Get script data parameters
	win.marble.init = function(el, options) {
		var params = dataset(el),
		urlParams = ulib.url().params,
		//	User configurable parameters
		args = ulib.utils.extend({
			fps: 60,
			horizontal: 0,
			vertical: 0,
			zoom: 0,
			zoommax: 50,
			zoommin: -250,
			spin: 9,
			startspin: true,
			animate: true,
			animatezoom: false,
			allowmousewheel: true,
			allowuserinteraction: true,
			allowfullscreen: true,
			allowvrmode: true,
			vrmode: false,
			vreyeseparation: 10,
			showspinbutton: true,
			showsavefilebutton: false,
			savefilepassthrough: false,
			allowcrossorigin: true,
			addcdnparameter: true,
			cdnparameter: "cdnkey",
			clicktotogglespin: false,
			usedeviceorientation: false,
			behave: true,
			showmenu: true,
			overlay: false,
			menutimeout: 3500,
			slideshowdelay: 9000,
			slideshowindex: 0,
			slideshowpaused: false,
			width: el.parentNode.offsetWidth,
			height: el.parentNode.offsetHeight || 480,
			img: "",	//	TODO: add default img, when img is missing!
			imgcube: false,
			imgcubekrmode: false,
			previewimg: "",
			container: el
		}, ulib.utils.extend(params, options || {})),
		useroverride = false,
		isPaused = false,
		canceldecelerate = false,
		isConfigShown = false,
		prevSpin,
		//	Three.js components
		renderer,
		vreffect,
		scene,
		camera,
		sphere,
		materials = [],
		sphereMaterial,
		sphereMesh,
		textureLoader,
		//	Control variable
		allowOrbitControls = false,
		hadOrbitControl = false,
		//	Mouse variables
		movedMouse = false,
		userX = 0,
		userY = 0,
		userHorizontal = 0,
		userVertical = 0,
		prevX,
		prevY,
		diffX,
		diffY,
		//	Ref: https://gist.github.com/gre/1650294
		easeOutCubic = function (t) { return (--t)*t*t+1; },
		//	args.fps will allow the user to set the fps - this can greatly reduce CPU load, with many pics on a page
		//	Ref: http://codetheory.in/controlling-the-frame-rate-with-requestanimationframe/
		frameNow,
		frameThen = Date.now(),
		frameInterval = 1000/args.fps,
		frameDelta,
		otherImageActive = false,
		marblePreviewImage,
		ready = function(){},
		renderReady = function(){},

		//	Device orientation
		orientation,
		deviceOrientation,
		doLast = {alpha: null, beta: null, gamma: null},
		doDiff = {alpha: 0, beta: 0, gamma: 0},
		orbitControls,
		orientationControls,
//		clock,
			clock = new THREE.Clock(),
		canRender = true,

		sizeTimer,
		slideShowTimer,
		hideMenuTimer,

		forceRender = function(){
			canRender = true;
			otherImageActive = false;
			render();
		},

		dispose = function(){
			canRender = false;

			clearInterval(sizeTimer);
			clearInterval(slideShowTimer);
			clearTimeout(hideMenuTimer);

			scene.remove( sphereMesh );

			if(sphereMaterial && sphereMaterial.map && sphereMaterial.map.dispose) {
				sphereMaterial.map.dispose();
			}
			sphereMaterial.dispose();

			for(var m = 0; m < materials.length; m += 1) {
				if(materials[m] && materials[m].map){
					materials[m].map.dispose();
				}
				materials[m].dispose();
			}

			if(renderer){
				var domParent = renderer.domElement.parentElement;
				domParent.classList.remove('marble');
				domParent.removeChild( renderer.domElement );

				renderer.forceContextLoss();
				renderer.context = null;
				renderer.domElement = null;

				renderer.dispose();
				renderer = null;
			}
		},

		//	Main render method
		render = function(){
			if(!canRender) {
				return false;
			}
			//	See if anyone else if already rendering
			if(args.behave){
				if(!otherImageActive) {
					win.marble.pubSub.trigger('isActive', true);
					//	Remember to set our variable back to false
					otherImageActive = false;
					requestAnimationFrame(render);
					renderReady();
					renderReady =  function(){};
				}
			} else {
				//	Render at each frame
				requestAnimationFrame(render);
				renderReady();
				renderReady =  function(){};
			}

			frameNow = Date.now();
			frameDelta = frameNow - frameThen;

			//	See if we're ready to render
			if (frameDelta > frameInterval) {
				frameThen = frameNow - (frameDelta % frameInterval);

				

/*
				if(args.usedeviceorientation && deviceOrientation) {
					//	Find the differences
					for(var i in doLast) if(doLast.hasOwnProperty(i)){{
						if(doLast[i] === null) {
							doDiff[i] = 0;
						} else {
							doDiff[i] = deviceOrientation[i] - doLast[i];
						}
						doLast[i] = deviceOrientation[i];
					}}

					if(doDiff.alpha) {
						args.horizontal -= doDiff.alpha;
					}
					if(orientation === 0) {
						if(doDiff.beta) {
							args.vertical += doDiff.beta;
						}
					} else {
						if(doDiff.gamma) {
							args.vertical += doDiff.gamma * (orientation * -1/90);
						}
					}
				}
*/

				//console.log('clock', clock);

				if(args.allowuserinteraction) {
					if(args.usedeviceorientation && orientationControls) {
//						orientationControls.update(clock.getDelta());

						orientationControls.update(hadOrbitControl);
						hadOrbitControl = false;

					}
					if(allowOrbitControls && orbitControls) {
						orbitControls.update(clock.getDelta());
					}
				}



				//	If we want to keep spinning
				if(!useroverride && args.startspin && !!args.spin){
					args.horizontal += args.spin / args.fps;
				}

				//	Note: Limiting vertical to 85 ensures the user won't get stuck pointing straight up or down, when using the mouse.
				args.vertical = Math.max(-85, Math.min(85, args.vertical));

				//	Adjust the position
				sphereMesh.rotation.y = THREE.Math.degToRad(args.horizontal);
				sphereMesh.rotation.x = THREE.Math.degToRad(360-args.vertical);
				sphereMesh.position.z = args.zoom;

				if(args.vrmode) {
					vreffect.render(scene, camera);
				} else {
					renderer.render(scene, camera);
				}
			}
		},
		initRender = function(){
			renderer.setSize(args.width, args.height);
		},
		enableVRMode = function(width, height){
			vreffect = vreffect || new THREE.StereoEffect(renderer);
			vreffect.eyeSeparation = args.vreyeseparation;
			vreffect.setSize(width, height);
		},
		clickedExpand = false,
		prevStyle = {};

		//	We've already been setup
		if(args.marbleready) {
			return false;
		}

		//	Set default cube order depending on cube kr mode
		args.imgcubeorder = args.imgcubeorder || (args.imgcubekrmode? "r,l,u,d,b,f":  "r,l,u,d,f,b");

		//	Add device orientation support
		//	TODO: remove?
		/*
		if(args.usedeviceorientation && window.DeviceOrientationEvent) {
			window.addEventListener('deviceorientation', function(e){
				orientation = window.orientation;
				deviceOrientation = {
					alpha: e.alpha,
					beta: e.beta,
					gamma: e.gamma
				};
			}, false);
		}
*/

		//	Behave ourselves when others are active
		if(args.behave) {
			win.marble.pubSub.on('isActive', function(value){
				otherImageActive = value;
			});
		}

		//	When args are requested
		win.marble.pubSub.on('getArgs', function(){
			win.marble.pubSub.trigger('args', args);
		});

		//	When args are being set
		win.marble.pubSub.on('setArgs', function(obj){
			obj = obj || {};
			for(var i in obj){if(obj.hasOwnProperty(i) && args.hasOwnProperty(i)){
				args[i] = obj[i];
			}}
		});

		//	Make sure we have numbers, not strings, and actual booleans
		ulib.utils.each(args, function(key, value){
			//	Allow url to override
			value = typeof urlParams['marble'+key] !== "undefined"?
				urlParams['marble'+key]:
				value;

			if(!isNaN(parseInt(value, 10))) {
				args[key] = +value;
			}
			if(value === "false") {
				args[key] = false;
			}
			if(value === "true") {
				args[key] = true;
			}
		});

		args.container.setAttribute("class", (args.container.getAttribute("class")? args.container.getAttribute("class") + " ": "") + "marble");
		args.container.style.position = "relative";
		args.container.style.width = args.width + "px";
		args.container.style.height = args.height + "px";

		//	Setup three.js rendering
		var init = function(args){
			renderer = new THREE.WebGLRenderer({
				antialias: true,
				preserveDrawingBuffer: true
			});
			scene = new THREE.Scene();
			camera = new THREE.PerspectiveCamera(75, args.width/ args.height, 1, 1000);
			sphere = new THREE.SphereGeometry(100, 100, 40);
			sphereMaterial = new THREE.MeshBasicMaterial();
			sphereMesh = new THREE.Mesh(sphere, sphereMaterial);
			textureLoader = new THREE.TextureLoader();
			if(args.allowcrossorigin) {
				textureLoader.setCrossOrigin("");
			}

			if(args.allowuserinteraction) {


				console.log('set orbitcontrols');
				orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
				
				orbitControls.target.set(
					camera.position.x + 0.0001,//+ 0.15,
					camera.position.y,
					camera.position.z
				);
				
				orbitControls.noPan = false;
				orbitControls.noZoom = !args.allowmousewheel;


				//	Add device orientation support
				if(args.usedeviceorientation && window.DeviceOrientationEvent) {
					//element.addEventListener('click', fullscreen, false);
					orientationControls = new THREE.DeviceOrientationControls(camera, true);
					orientationControls.connect();
					//orientationControls.update();
					console.log('SET orientation controls');
				}

			}


			initRender(args.width, args.height);

			args.container.style.cursor = prefix({
				prop: "grab",
				dashed: true,
				force: true
			});
			//	Required for PEP pointer actions to work
			args.container.setAttribute("touch-action", "none");

			//	Create a menu box
			var menuBox = document.createElement("div"),
				displayBox = document.createElement("div");

			menuBox.setAttribute("style", "opacity: 0; transition: opacity .75s ease-in-out; padding: 1rem; position: absolute; background-color: rgba(0, 0, 0, 0.25)");
			menuBox.setAttribute("class", "marbleMenuBox");
			displayBox.setAttribute("style", "display: none; margin-top: 5rem; position: absolute");
			displayBox.setAttribute("class", "marbleDisplayBox");

			//	Optionally add a filter/overlay
			if(args.overlay) {
				var overlayDiv = document.createElement("div");
				overlayDiv.setAttribute("class", "marbleOverlayDiv");
				overlayDiv.setAttribute("style", "position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.5; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDE0IDc5LjE1Njc5NywgMjAxNC8wOC8yMC0wOTo1MzowMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MUY0REIyREI4Q0Q5MTFFNThGQkNFNTFFQzlCQTc1MjQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MUY0REIyREM4Q0Q5MTFFNThGQkNFNTFFQzlCQTc1MjQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxRjREQjJEOThDRDkxMUU1OEZCQ0U1MUVDOUJBNzUyNCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDoxRjREQjJEQThDRDkxMUU1OEZCQ0U1MUVDOUJBNzUyNCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PnPKSHYAAAAUSURBVHjaYmKAgP9MIAKIGQECDAAPOgIE2rI1dwAAAABJRU5ErkJggg==')");
				args.container.appendChild(overlayDiv);
			}

			//	Add all the nodes
			args.container.appendChild(menuBox);
			args.container.appendChild(displayBox);
			args.container.appendChild(renderer.domElement);

			if(args.vrmode) {
				enableVRMode(args.width, args.height);
			}

			//	Show our image in the background of the spinner
			if(args.previewimg) {
				marblePreviewImage = document.createElement('img');
				marblePreviewImage.setAttribute("src", args.previewimg);
				marblePreviewImage.className = "marble-preview-image";
				marblePreviewImage.setAttribute("style", "position: absolute; width: " + args.width + "px; height: " + args.height + "px; opacity: 0.5");
				args.container.insertBefore(marblePreviewImage, renderer.domElement);
			}

			//	Hide the loading spinner
			var hideSpinner = function(){
					var spinner = args.container.getElementsByClassName("marbleSpinner")[0];
					if(spinner) {
						spinner.style.display = "none";
					}
					if(marblePreviewImage){
						marblePreviewImage.parentNode.removeChild(marblePreviewImage);
					}
				},
				//	Ref: https://stackoverflow.com/a/33647870/6637365
				hashCode = function(str) {
					var hash = 0, i = 0, len = str.length;
					while ( i < len ) {
						hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
					}
					return hash;
				},
				//	Ref: https://stackoverflow.com/a/38777164/6637365
				setUriParam = function(uri, key, val) {
					return uri
						.replace(new RegExp("([?&]"+key+"(?=[=&#]|$)[^#&]*|(?=#|$))"), "&"+key+"="+encodeURIComponent(val))
						.replace(/^([^?&]+)&/, "$1?");
				},
				addCdnHash = function(url) {
					return setUriParam(url, args.cdnparameter, hashCode(url));
				};

			//	Setup camera, sphere and scene
			camera.target = new THREE.Vector3(0, 0, 0);
			sphere.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));

			if(args.imgcube) {
				//	Load cube mapped images
				//	ref: view-source:http://math.hws.edu/eck/cs424/notes2013/threejs/cube-map-demo.html
				//	Get all our textures
				var loadTextures = function(textureURLs, callback) {
					var loaded = 0;
					function loadedOne() {
					   loaded += 1;
					   if (callback && loaded == textureURLs.length) {
						   for (var i = 0; i < textureURLs; i += 1) {
							   textures[i].needsUpdate = true;
						   }
						   callback();
					   }
					}
					var textures = [];
					for (var i = 0; i < textureURLs.length; i++) {
					   var texUrl = args.addcdnparameter? addCdnHash(textureURLs[i]): textureURLs[i];
					   var tex = textureLoader.load(texUrl, loadedOne);
					   textures.push(tex);
					}
					return textures;
				},
				myImgCubeImgs = args.img.split("|"),
				textures,
				cubeorder = args.imgcubeorder.split(",").reduce(function(acc, cur, i) {
					acc[cur] = 6-i;
					return acc;
				}, {});

				// Sort the textures in r l u d b f order
				myImgCubeImgs.sort(function(a,b){
					//var order = {'r': 6, 'l': 5, 'u': 4, 'd': 3, 'b': 2, 'f': 1},
					var scoreA = cubeorder[a[a.lastIndexOf("_")+1]] || 0,
						scoreB = cubeorder[b[b.lastIndexOf("_")+1]] || 0;
					return scoreB - scoreA;
				});

				textures = loadTextures(myImgCubeImgs, function(tex){
					hideSpinner();
					ready();
					render();
				});

				for (var i = 0; i < 6; i += 1) {
					if(args.imgcubekrmode) {
						//	Flip the texture horizontally, as we're viewing it inside out
						//	Except for the down texture as it needs to be vertially flipped
						if(i === 2 || i === 3) {
							textures[i].flipY = false;
						} else {
							//	Ref: http://stackoverflow.com/a/23684251/6637365
							textures[i].repeat.set(-1, 1);
							textures[i].offset.set( 1, 0);
						}
					}
					materials.push( new THREE.MeshBasicMaterial( {
					   color: "white",
					   side: THREE.BackSide,
					   map: textures[i]
					}));
				}

				sphereMesh = new THREE.Mesh( new THREE.CubeGeometry(100,100,100), new THREE.MultiMaterial(materials) );
				scene.add(sphereMesh);
			} else {
				//	Load our image
				var texUrl = args.addcdnparameter? addCdnHash(args.img): args.img;
				textureLoader.load(texUrl, function(tex){
					sphereMaterial.map = tex;
					scene.add(sphereMesh);
					hideSpinner();

					ready();
					//	Start rendering
					render();
				});
			}

			var getpn = function(node){
				return (node && node.parentNode)? node.parentNode: {};
			};

			//	Listen for size changes, and apply to camera and renderer
			var prevParentWidth = getpn(args.container).offsetWidth,
				prevParentHeight = getpn(args.container).offsetHeight,
				prevContainerWidth = args.container.offsetWidth,
				prevContainerHeight = args.container.offsetHeight;
			sizeTimer = setInterval(function(){
				var wasUpdated = false;
				if(getpn(args.container).offsetWidth !== prevParentWidth || getpn(args.container).offsetHeight !== prevParentHeight) {
					//	Resize it
					args.width = getpn(args.container).offsetWidth;
					args.height = getpn(args.container).offsetHeight;

					//	Set new prev. size
					prevParentWidth = getpn(args.container).offsetWidth;
					prevParentHeight = getpn(args.container).offsetHeight;

					wasUpdated = true;
				} else if(args.container.offsetWidth !== prevContainerWidth || args.container.offsetHeight !== prevContainerHeight) {
					//	Resize it
					args.width = args.container.offsetWidth;
					args.height = args.container.offsetHeight;

					//	Set new prev. size
					prevContainerWidth = args.container.offsetWidth;
					prevContainerHeight = args.container.offsetHeight;

					wasUpdated = true;
				}

				if(wasUpdated) {
					//	Update camera and renderer
					//	Ref: http://stackoverflow.com/questions/20290402/three-js-resizing-canvas
					camera.aspect = args.width / args.height;
					camera.updateProjectionMatrix();
					initRender(args.width, args.height);
				}
			}, 500);

			//	Check when fullscreen can be enabled
			if (screenfull.enabled) {
				//	When we change full screen
				document.addEventListener(screenfull.raw.fullscreenchange, function () {
					//	If our widget started fullscreen
					if(clickedExpand) {
						//	We are now full screen
						if(screenfull.isFullscreen) {
							prevStyle.top = args.container.style.top;
							prevStyle.left = args.container.style.left;
							prevStyle.width = args.container.style.width;
							prevStyle.height = args.container.style.height;
							prevStyle.position = args.container.style.position;

							//	Resize the container to fill the screen
							args.container.style.position = "fixed";

							args.container.style.top = "0";
							args.container.style.left = "0";
							args.container.style.width = "100%";
							args.container.style.height = "100%";

							//	Hide the menu
							hideMenuOnTimeout();
						} else {
							//	We exited full screen
							args.width = prevStyle.width;
							args.height = prevStyle.height;

							//	Set the container back to normal
							args.container.style.position = prevStyle.position;
							args.container.style.top = prevStyle.top;
							args.container.style.left = prevStyle.left;
							args.container.style.width = prevStyle.width;
							args.container.style.height = prevStyle.height;

							clickedExpand = false;
						}
					}
				});
			}

			//	Add a spinner, ref; http://codepen.io/msisto/pen/LntJe
			var styles = [
					'@keyframes marblespinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }',
					'.marbleSpinner {'+
					'	animation-duration: 0.75s; animation-iteration-count: infinite;'+
					'	animation-name: marblespinner; animation-timing-function: linear;'+
					'	height: 30px; width: 30px; border: 8px solid #ffffff;'+
					'	border-right-color: transparent; border-radius: 50%; display: inline-block;'+
					'	margin: -15px 0 -15px;'+
					'}'
				],
				styleEl = document.createElement('style'),
				spinnerDivContainer = document.createElement("div"),
				spinnerDiv = document.createElement("div");
				spinnerDiv.setAttribute("class", "marbleSpinner");

			styleEl.setAttribute('id', 'marbleSpinnerKeyFrame');
			styleEl.id = 'marbleSpinnerKeyFrame';

			// Hack: make sure the style sheet works in older WebKits
			styleEl.appendChild(document.createTextNode(""));
			// Add to the page
			document.head.appendChild(styleEl);

			styleEl.textContent = styles.join("\n");

			//	Add the spinner
			spinnerDivContainer.setAttribute("style", "position: absolute; margin: 0 auto; width: 0; top: "+((args.height/2)-15)+"px; left: "+((args.width/2)-15)+"px;");
			spinnerDivContainer.appendChild(spinnerDiv);
			args.container.appendChild(spinnerDivContainer);

			//	Setup all our buttons
			var iconStyleCommon = "cursor: pointer; float: left; margin-left: 1rem; width: 3rem; height: 3rem; background-size: 3rem 3rem;",
				menuButtons = [],
				getMenuButton = function(name){
					for(var i = 0; i < menuButtons.length; i += 1) {
						if(menuButtons[i].name === name) {
							return menuButtons[i];
						}
					}
				},
				initMenuButtons = function(menuButtons) {
					menuBox.innerHTML = "";
					//	Add menu buttons
					ulib.utils.each(menuButtons, function(i, o){
						var button = document.createElement('div');
						if(o.init) {
							o.init(menuBox, displayBox, button);
						}
						//	Styles - first button has no left margin
						button.setAttribute("style", o.style + (i === 0? "; margin-left: 0": ""));
						button.setAttribute("class", "marble"+o.name+"Button");
						if(o.title) {
							button.setAttribute("title", o.title);
						}
						button.addEventListener("pointerdown", o.action);
						menuBox.appendChild(button);
					});
				},
				toggleSpin = function(){
					if(!args.startspin) {
						args.startspin = true;
					} else {
						if(args.spin) {
							prevSpin = args.spin;
							args.spin = 0;
						} else {
							args.spin = prevSpin;
						}
					}
				},
				toggleVR = function(){
					args.vrmode = !(!!args.vrmode);
					if(args.vrmode) {
						enableVRMode(args.width, args.height);
					} else {
						initRender(args.width, args.height);
					}
				};

			//	Show spin play/pause
			var fullScreenIcon = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3MUIwMjkyMDdDNEYxMUU1OTUzQjk0MzREOTFDNzZEQiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo4M0ZEODc2QTdDOTIxMUU1OTUzQjk0MzREOTFDNzZEQiI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjcxQjAyOTFFN0M0RjExRTU5NTNCOTQzNEQ5MUM3NkRCIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjcxQjAyOTFGN0M0RjExRTU5NTNCOTQzNEQ5MUM3NkRCIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Zudy1QAAAztJREFUeNrkmk1LFVEYx2fsbqJQb2mKb5G1aVFYm9z0BVyFn6BdLQLzetVejCCVrphoC6FNbW0ZfYDcBFYUdbWkoMCyIlGKiCAXt+n/0Bm4XO547zmdJ58z88DvCjLzzDz/+Z+XOWf8IAg8B2IInAK7QeEfc+0AP8E9MJFyoPhb4AxD3m6Q9oU7IA2+MuZfrxH+9H8z5y9IF+A7yDLm36xxoA+YAjmu5C4IQHERjCVZAIorNGxZzum7JADFBcvNIXBNgLA5jCfVAWGMgNtJ6wOKYx84YiNRysHi28ECaE2iAB3gMWi2ldAlAeiJ50F9EkeB8MnXW87rpxxp809AE0Nu8Q5oAU8Nin8Yh2GQbL+ohjydOAtOgmvVeSAIJNIOvgT6MVCS53qF41ckFt8C1gyK74/Il9vinFVpxXeAdYvFh4xGnLcRR9tHUa45zMfV9lFcBQV17hLolLAqfECN8w2a5/WDGcPRpQ4sSZkK9xoUP2hYPMUHafOAu+CtxvEZcMPaXFjIxsguNenpZLK9+Jkg7dUdC9slg+3FO6DYCS/AoTK2n+a4oLR3AXJCF3hXYvtprgtK3RytVU/9teokPZcFoOWrHnAfbEhTmnse0KQ6Nhrn18Bx8FmSAJx9QJvq0BqKxMir/8degIPgUZnVWxJjQU1HRQRHH0BP+o2ab0cFffVxFHyKmwNale3rKhy3Rx23P04CkO11Ni2oOYxIGgX2gl9qMqIbtHD5rIonXxoPpDiAPkVbBe/BZYPePm9Q/Hkwt+29IDrB4TIrLZMaa3gf/8NKDhv08zLiJnNVFG+yhpeVtBBLP8tb3OxUxIlt4JtB8X3SluHp53mFm56Mm+11BaCYUCekDW0/KHQHquqXoSE11J3w9Dcqqbe/6QkNnbfB0wb5M5KLD+cBXAsCWc6VHJsO8BnyZlwonut12JniOQTIulS8TQF+gHPe30/bvSQK8ArMeg6GLQFofjCeZAFoJLnkWdy0dLUTHHBNBI5hkETIJVkAimFXnMC5MUJOGJUuAO0LLOPvYcZr0DdAK5IdUGC+RqP0JnCHMT/t/CxKfxukuTvtCdDXWjstvB77ylXUtPrApmQB/ggwANwbw3PYox1nAAAAAElFTkSuQmCC')",
				spinPauseIconUrl = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDE0IDc5LjE1Njc5NywgMjAxNC8wOC8yMC0wOTo1MzowMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MzMyMzcyNzBENkM2MTFFNTk1RkZFOUNEQzU0OTAzQzciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MzMyMzcyNzFENkM2MTFFNTk1RkZFOUNEQzU0OTAzQzciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDozMzIzNzI2RUQ2QzYxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDozMzIzNzI2RkQ2QzYxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgrC1d0AAAMYSURBVHja7FuxbtswEGX8BV7c1eqadEjGbuqQ2c6QrE3RLvXS9AuszFnSoVMLNFkytEPdJR3rAkWRLV6SJYMNdIuH6A/Uu/hUMKwli5QoUaQe8ICAQGTx8Xi8Ox3XoihiJWEXuA7cEMYQY+Cc/v4DvBDGtGFNowB9YhfoKz5jArwBngNHwNB0AXCiA+A2sK1BVBThDPilsCeiAAWwD5xG5eEOGBTx7nktAPf0R+BTVg2ugK/IZ5RuAQGthAk4BrbLsoAO8HMOx6YLM+AOOc7MaEn+yD7w1sDJIzzgJTDQtQWGUX0wLHoL4Mp/YvXCKb13bgsIovoiyGsBdVx5EYdpfiFNgA45PBuwlxQ9pgnww1BvrwLMIR4vyyWSjsEDiybPKC85yWoBmK7+0pTMVI0dSqhSBfhdYWxfRu7wJG0L9C2efGzdgzQLmFJIKYM5KStbN0gqgMgUPTyF92XkEGdiIOQrBhsdhSzseMlzLhWe084bIPFbYKBoVip1uzDjmMpzsuD1Mh+wzdzBI+AmL0Df0mNvVZj/QADX0OMF6DoogMcL4DM34aMAu8xd3Auw4bAAHgqw7rAA3RZzHI0AjRNsLOC+EcFVTFqshC4MgxE2W4AtenJcxRwFuHBYgOvGCZITnDgqwDh2gjcOTv6WPwXOHRTgO58LjBwUYMQLEDomQigKgDhzSIB/cxU/jd0x+fI4HqM/Jf/nTcLvvGNyHzuwtt9TEGArPvlEAQLg0PLVx06RvSQLQOCHTlvLZDO2+DD6IBcQ8dLi1T8SB5J6hE6Az20Le2nvZxIAHRS2nXoWCbC1LORvpZyTLyya/NukfGdVo+SQyTYfG+71ZQVA1Llf8Btb8eU7a7N0HZ0imvyzVYFV1prgPlt0X9cFp1kmL2MBdfIJqXv+Pyh0Zg0Muisk4qCsW2MYJ3w1yDlO6NiWL+0VcF/wqsIVn5JFVnZvMAb2GL43eq8X5ATT4NFpgWJ0NFZysJjxgRVUydZ1eXqTxOgVkE9g2T6+PF142U7n7XEePhHF6ArjsRMLuQlf09iYabgxzuOvAAMAXH0FFZpokPMAAAAASUVORK5CYII=')",
				spinPlayIconUrl = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDE0IDc5LjE1Njc5NywgMjAxNC8wOC8yMC0wOTo1MzowMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MzMyMzcyNzRENkM2MTFFNTk1RkZFOUNEQzU0OTAzQzciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MzMyMzcyNzVENkM2MTFFNTk1RkZFOUNEQzU0OTAzQzciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDozMzIzNzI3MkQ2QzYxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDozMzIzNzI3M0Q2QzYxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pq9aECgAAAPeSURBVHja5Fu/UxpREH7c+AfYmBZsUkgKafKjChbWkkJboYwWyuQPAGZSRzITLWIhNhZahDSmFItEOymUIhYwYxeK3H9Admf2ksvlHnfwfpNv5pvRA+7ufe/t3u6+vcxoNGKasA5cAuYjxxAd4JD+fgBeR44pw5zCc5eIWWAx4bu8z7vAe+A5sA30Zd9kRvIKwIFsAVeB8wpERRFOgGfSzogCSGAJ2B/pw09gXca9e4L6oU1/A34C5pg+4OqqAW+Bz0VOJCJAHfgV+IKZAzrUK2BzWpObRoAF4AXNwDyzAzvAG+CyagHKwB8pvLoJ5EiEuioBcMaPmP2oEaUKUJ5UWcPAe23JEqDuyMxHsZlm0rwUM19j7qKWJMK4SHCBHN4sYIMXPY5bAadsdvCR98jmCbBr6aNOJHJspRUg77jd87BG2WmiAIeSIrwD9DHEDUv8ydskAUqSYnssZmyH/kcH9Az42bAAeUrXuQLsSbrQZcyxAQn8xLAQ++HM1YsUM3SktHckxAqJYgLlOAG2NN8Emski8J0BAV7HCbBqaDbekBAdjdd8FKTOXsj5mcztB2QSr4A9nWYQFsAGtMlTVzT4h7WwAFnLghaM2p4ymdXff5ELC2Bj2DukAArZVXSNIgqwbnkIi6ugQGbhqxAg70gs36KnRUOiEDkUYMmhhManAsdjCqhEkfWYmxhSSF1lghuorgoQoEkmPBARYN1xEXAFHIs4wf8anuYYXBVeTvm7rsc0dGEoBCY0FwKBnD/n6MDnyQFuip4IBXhwbPDotD9QSivsQFGAa0cGjsnLkeS8peeCE1yg5d5XkLT9doJdS+0cw14sp+8oukYncIL3bIruCoXA/ORUcaKGwvpBIHRukZ3vU6KjOkv9Es4F2hYMHpc7trjoqk63wwL4BkXYIgens+nKjwqAODHg3W9ZZKdGE07i0uEzpqAXlwPcfv/OzFWjDnn1gPcSnRlv4Oh995i5fYizvx77Mf2zd5L6eXdD5ywCb0bm0Y+ON65HCHtvr2Y0/cct+4NoPSCKa4EKi83oRgfPEyCw1cGMCVDhVYR4z8nKDA2+yst3xtUEO8yt9thxXr/J+zCpKNpgbtcMsRVnY9wX0lSFVxx1irjky0lfmqRb3CURjmnifFkCBCLUHbH5ctqwftKNkQYFE76lg68m2byoAIyCCd1NTWnsvTDO28sUIIgTdDc1xWFAK7LApqxriu4NBk1N24ZsfTEuvNUpQNQs0Eeo3Grz6VqFSW2dh4yit8eXyROvSaj2oKDBy9PSy3YZTa/PF9mfXuRs5HjgxPzQgHt0rKP6ifNLgAEAGWqTS07pXFMAAAAASUVORK5CYII=')",
				saveIconUrl = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTM4IDc5LjE1OTgyNCwgMjAxNi8wOS8xNC0wMTowOTowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NTZFRjMxMDNFMTIzMTFFNkJCMDNGNUFFN0E4MUUxQzciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NTZFRjMxMDRFMTIzMTFFNkJCMDNGNUFFN0E4MUUxQzciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo1NkVGMzEwMUUxMjMxMUU2QkIwM0Y1QUU3QTgxRTFDNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo1NkVGMzEwMkUxMjMxMUU2QkIwM0Y1QUU3QTgxRTFDNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PmMhhDsAAAMhSURBVHja7Js9aBRBFMfnNptoDMYgogSjiZB4FtppIRERvwoRUQsbG8FC0MZOISCKjaWNkZSCYGEhglgkIILBSkS08QMJ+IUKih+IMV5u/T93Do5z1tvZubndnX0Pfiw3O7Mz+983szPvZktBEAhYNzgF9oIVoCKyZSXggY/gEbgDboFvxheGAD04PgRrRb7sM7gMzoNfSS9Cqp7O4c2TLQVj4DEYMvGAZzkVoN6+gp3gQRIP6BX5tyXgPhjRLeiDWUX6RXlBT/6ugrLsb0mtIss/lYOayqieAXAOLG44dw9cAwfl0260TukBO7Q8AV1gJvjXRunt0EB/YGaTimtGMaEof7Xu/PH/1DMHRuLW5UXoMqBIW2Popl808qpeb/UeMQ52R5StecLGuGNAu2yBRt6FMfJMgUMR53rjjglezge/66aekHcBjD3BBQGMPMEVARJ7gksCJPIE1wSI6wmrXRYgjidM1161rgrQzBNWyem+0wI084RjYLnrAtQ84UjEucPtFOCHRt7vLa77ihSi0fa0U4BhjbzrLNR/SZFW9nWiR4YN2AQmm8QDKEK7EhywUP9rRVq3jgCdLXgKuyRJrMuwblX5qk4XeJvyYGYaAlfda6AjwAsRRmDTsnEbF9UdBPeD5ync/Elw18aFfc38M2C9COPxdKQoT9VCu2oD3ns5mZmypayfoMxvcNaVWVIRZoIsAAvAArAALAALwAKwAC2bCZIdlVPhLktTYd1p8zx4CSaE5n4hXQH6wG2wOaMP9ISMN7yy1QVuZPjmyWivE+0k6bAhwBDYloNuTf/6jNoQYDBHY9ugjTFAtXt0Vq7Vq8I8aJnEKIhKG6Z6FEv2lgsQKNJot+a+lJ82heqGY7TVyjygIwNzCd+ksJd2A3gmyAKwACwAC8ACsAAsAAvAArAAmRLggyLtjSKNYnFzKd9DxaD9kQuZLXKt79UtLzco8tF2061y/Z1WPGCRQfv/fjf4Dsf+gvaAT55QfzZXmCGABLhZYAGmqQssE2FYqa+AApRL8vN52j5+BmwX4UcF847eMIXwforwv4ML4MkfAQYAGc5s3Pr7kNQAAAAASUVORK5CYII=')",
				vrIcon = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTM4IDc5LjE1OTgyNCwgMjAxNi8wOS8xNC0wMTowOTowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTcgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OEU5RTgwMEM0OUUzMTFFNzk3M0NDQUI3RDlGNkZENkUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OEU5RTgwMEQ0OUUzMTFFNzk3M0NDQUI3RDlGNkZENkUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo4RTlFODAwQTQ5RTMxMUU3OTczQ0NBQjdEOUY2RkQ2RSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo4RTlFODAwQjQ5RTMxMUU3OTczQ0NBQjdEOUY2RkQ2RSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PvM73VwAAASQSURBVHja7JtbSNtXHMfP/2+M8RJ1CeRF0MkcRWUbDHGUPkxpC2vBOS1se6vQMbaXrfRl9KFsMPbQhw36MFYJFlp6Wy0FESzDkiHo07zOeEmM1xjjPXFeE2Oy71nxYfav+Z+T/1+o//ODv3+Q8zuXz/md3+UkkRKJBDGyyMTgIgAIAAKAACAACAACgABgWDHRP263m9hstutWq/X09vb2qizLppO42Hg8HktPT88ymUwDHo/np4qKCkKcTieJRCLDCYPJysrKE1oHScPDw6S0tNSQFdHExES97HA47hr1/MdisUIZ5+ENowJIS0uLyXt7e/8YFQB8QFzkAQKAACAACAACgNGLIc7CYheZVMf4+Pj5/Pz8T1BE7eF9CQXVpyg4MnUqZjDM9vPZ2Vlnbm6uZW1tLVFSUnJVkqQzSGrSuTpFUXCftZDY2tpy+Xy+t2gxcfDp6+ujfTZqXbxg4Y+DwWCR0pjI6U+hoPuLtc+xsbGvmQGA/g2lSSg8v2u1+N3d3dvJxtvZ2TEjq+1gBcDkAzDAYEFBwY8qm38WCoXupWr2q6urTahXvkrWLiMjI9rS0vLh0tLSc12cICU2Ojr6Lkvn3d3dl1NZfDQaDTc3N3+htn1dXR2Znp6+yPR5p9ojgJ34Q6Xp/++ZnJz8gdf0sZu/8oy5sbHRrfkRWFxcbOL03F5eC8DZ/5NHLxwOP9L8CMDTPuFKNGR5nhcAIspTzpuenzUHkJeXx5dopHDh4nA4uPRY5qoaQFFR0fc8k0H8zuUFUFxcfJVHD5HqNz0s4BLPZGw2W20KgaCaVaG1tZVkZmae1RxATk7OO9hNph1BGCR2u732kJwiPDMzcz0QCNyEo1xTagPdj9vb25kAlJeXX87Kynpbt1S4p6dHVSja3Nwswzuk1MfQ0BDxer3Z+239fr91amrq80OGDMGpFagZ0+PxvIfIsaVrKowY+/fc3NwHR01kZGSkEO91JX2EqI8O0+vq6qJh8xUdWIsfSVH5UWOur69fOJZaYF8WFhauoRp7/8DC38ROXsGEo0o62Mkvk+0ijsW1w8ZElneFfpBzoAaoXF5evqEETlcA+wIIL9DHA2Rtj49qR6F0dnYmNeOBgQGSbDFYcDOs0AlrcqUyd00AMFSRt9Smssg67xzHnJirwVQEoL9V2xZWdWwf1x0LAJxTb29vr+r28CUdcHpTJwZAMBj8paGhQXX7mpoaajG3TwqAeH9/fyOrEmL6TXoN8doDQHS4Ty8qWKWqqor6gtbXHoDb7ea+FfL5fLW6A5Akyayj8/NXV1dz6yN3oNdiy7oCoHftenWOOFuYin5lZSXNDL/Tc/0yLTb06JkmNJFIJOV+YAF39PpRhyzLFuJyuYgeWRayuUaeC02lh16v6zHHwcHBlzs1Pz//DUsZmUwQ95vo1++0AtDW1kbT44dazS8Wi0XhYOv/+5rcvnnRGt1sNp/HQO14M5sTOiXZ2dmkrKys3mQyPdPDZAOBwDlUlC8sFgvvcSJWq5VemZ2y2+0e+j9J/GjK4CIACAACgAAgAAgAAoAAYFj5V4ABAAX4KMY4F830AAAAAElFTkSuQmCC')";

			if(args.allowvrmode && screenfull.enabled) {
				menuButtons.push({
					name: "VR",
					title: "Toggle VR mode",
					style: iconStyleCommon + "background-image: " + vrIcon,
					action: function(e){
						var event = e || window.event;

						toggleVR();

						e.preventDefault();
						e.stopPropagation();
					}
				});
			}

			if(args.allowfullscreen && screenfull.enabled) {
				menuButtons.push({
					name: "Expand",
					title: "Toggle full screen",
					style: iconStyleCommon + "background-image: " + fullScreenIcon,
					action: function(e){
						var event = e || window.event;
						clickedExpand = true;

						//	We are now full screen
						if(screenfull.isFullscreen) {
							screenfull.exit();
						} else {
							screenfull.request(args.container);
						}

						e.preventDefault();
						e.stopPropagation();
					}
				});
			}

			if(args.showspinbutton) {
				menuButtons.push({
					name: "Spin",
					title: "Toggle image spinning",
					style: iconStyleCommon + "background-image: " + spinPauseIconUrl,
					action: function(e){
						var event = e || window.event;

						toggleSpin();

						initMenuButtons(menuButtons);

						e.preventDefault();
						e.stopPropagation();
					},
					init: function(menu, display){
						var mButton = getMenuButton("Spin"),
							isPlaying = (args.startspin && args.spin);

						mButton.style = iconStyleCommon + "background-image: " + (isPlaying? spinPauseIconUrl: spinPlayIconUrl);
						mButton.title = isPlaying? "Pause spinning": "Resume spinning";
					}
				});
			}

			if(args.showsavefilebutton) {
				menuButtons.push({
					name: "Picture",
					title: "Save picture",
					style: iconStyleCommon + "background-image: " + saveIconUrl,
					action: function(e){
						var event = e || window.event,
						saveFile = function (strData, filename) {

							win.marble.pubSub.trigger('saveFile', strData, filename);

							if(!args.savefilepassthrough) {
								//	Ref: http://stackoverflow.com/a/26197858/6637365
								var link = document.createElement('a');
								if (typeof link.download === 'string') {
									document.body.appendChild(link); //Firefox requires the link to be in the body
									link.download = filename;
									link.href = strData;
									link.click();
									document.body.removeChild(link); //remove the link when done
								} else {
									location.replace(uri);
								}
							}
						},
						imgMime = "image/jpeg",
						downloadMime = "image/octet-stream",
						imgData = renderer.domElement.toDataURL(imgMime);

						saveFile(imgData.replace(imgMime, downloadMime), "marblescreenshot.jpg");

						e.preventDefault();
						e.stopPropagation();
					}
				});
			}

			//	Optionally show buttons for slideshow
			if(args.slideShowImages && args.slideShowImages.length) {
				menuButtons.push({
					name: "SlideLeft",
					title: "Previous image",
					style: iconStyleCommon + "background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDE0IDc5LjE1Njc5NywgMjAxNC8wOC8yMC0wOTo1MzowMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MkRDRDUxN0RENkM1MTFFNTk1RkZFOUNEQzU0OTAzQzciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MkRDRDUxN0VENkM1MTFFNTk1RkZFOUNEQzU0OTAzQzciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoyRENENTE3QkQ2QzUxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDoyRENENTE3Q0Q2QzUxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PqbmyNsAAAHbSURBVHja5JsxUsMwEEVl34GOIpwkcAMoVKOjJBdIRx3UQsMNYg5B75oqNzAbkswwGQa0Y2n37+zObJORFf+32R9bssM0TYGR15RP0+/xSbmhvGLOWTMj5QfnGM7ki5PI/2KnJD5dnEfRcd03hbIYKJeFY28oxyAXiXJ78VlXcmDP+JIlY+xCWXxx9MF2xDnirQM4VP5l7iS9YfHbGhP1nsVbBBBrircGoErPWwWQalfeEoBm4i0AiC3FowNo0vNWAKTWlUcGICYeEUCUFI8GQKTnUQEk6cojAVATjwAgaorXBqDS8ygAknblNQHAiNcAEJHESwOA6HktAAmt8pIAYMVLAIjI4lsDgOx5KQD36JU/B2dzdAq2okPwgOC1BQbvANaU2TOA87/A2jOAQ6zQIUiY4Aq5HSTvBbJnALCeIH0dAOcJGhdCUJ6guSaYPQOA8QTtewF1T0C4GVL1BKS9wewZgJonoK0HiHsC4oKIqCcgPyOUPQMQ8wT0NcHmnmBhUbSpJ1h6Vjh7BtDME6ztC1T3BIsbI1U9wfI7Q9kzgGqeYH1vcLYncAC8M8burXgCZ3v8lnJXMG4Mx3eHpeOZ8vGnttq/gIHyjvLtj6q/Uj4oe8J4Os+i+BJgAG0f5QGgxWXtAAAAAElFTkSuQmCC')",
					action: function(e){
						var event = e || window.event;

						args.slideshowindex -= 1;
						if(args.slideshowindex < 0) {
							args.slideshowindex = args.slideShowImages.length-1;
						}

						setSlideShowImage(args.slideshowindex);

						e.preventDefault();
						e.stopPropagation();
					}
				});

				var pauseIconUrl = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDE0IDc5LjE1Njc5NywgMjAxNC8wOC8yMC0wOTo1MzowMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MTAxN0ZFRjJENDZFMTFFNUIyNzhGRjVBRUNFNENEOTQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MTAxN0ZFRjNENDZFMTFFNUIyNzhGRjVBRUNFNENEOTQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxMDE3RkVGMEQ0NkUxMUU1QjI3OEZGNUFFQ0U0Q0Q5NCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDoxMDE3RkVGMUQ0NkUxMUU1QjI3OEZGNUFFQ0U0Q0Q5NCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Ptx+IfMAAADESURBVHja7NvBDYMwEATAC+1QBKQz6qGJmE86oB7HlpwCHMkoSuak/Z1gPf+LnHOUrCUpj5mtfT8+yD6oU2q94lbLRcQjxs+9JHXs191lcKdjuujxddaO3e2Cx9dZpvjzAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPBLAMcX9kqX/amdqddT8nPQqfr+PlXvzFzyHNTpbL3mlwADABuj5bZD8flJAAAAAElFTkSuQmCC')",
					playIconUrl = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDE0IDc5LjE1Njc5NywgMjAxNC8wOC8yMC0wOTo1MzowMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MTAxN0ZFRjZENDZFMTFFNUIyNzhGRjVBRUNFNENEOTQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MTAxN0ZFRjdENDZFMTFFNUIyNzhGRjVBRUNFNENEOTQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxMDE3RkVGNEQ0NkUxMUU1QjI3OEZGNUFFQ0U0Q0Q5NCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDoxMDE3RkVGNUQ0NkUxMUU1QjI3OEZGNUFFQ0U0Q0Q5NCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PjCCRisAAAIHSURBVHja5FvLUcMwEF00aoMGEirIxU4RuAJuudEATgVpABrARZCcaIC4gvRhbFgzwuMRMZal/byZTTL52KO3b59WkQ1N0wDGsflG95w774uOm+4B8fMCUbVRgHAYz2f3bRzbyCUT4FOAixoV8dzGRSMBLhE7VIb4EhjDqo03SaVh/vm7DIkotZWAzx+6OGskwMWJW2mYwMfLUAW5VgLYGWXoEhjDoY0Xqv4QgwDXH0pqPYSJeC6SU2dMBZDsKE2i8/ZGecZFlzoFkFEEFQKSNVIGaCHDRJRaFeDigv1DqZUAF/uliOBCwGJGaYAPVks0UpwUMESF64x3rQQE8QcD/PE0Z+qUoIChUa61KWBolF0iX69dY0hTwBjuwPNnjAH5+PD5gwYCvEapoQSG6PqGjWYCvsatrQSGpggaCdhj5n/NCFbBwB9xzaBuFugzfvB9yQod+NXrAmkEFLhMBk0EVE5MhtWWcSkm2BtcNfdA3BQQfOPEMKrzDSywa2S1ZZyTAgqIsE9IkYBgBsepBPp9wOjXGloiGS9TnTwlASQumkpFQBGrximZYB3b4KgogPQ9BjZCnedAGGbBgW+BwbXCdgG5P8DMPXuOCugzvuY0+BAKYH8TlZmZ9QKY30E2VQHJenYKBJxQ7iIGPqUE3ClN1OCvUcAWBN0l+pcC6kHPfit98B0+BRgAKaBxelJwvzEAAAAASUVORK5CYII=')";

				menuButtons.push({
					name: "SlidePause",
					title: "Pause slideshow",
					style: iconStyleCommon + "background-image: " + pauseIconUrl,
					action: function(e){
						var event = e || window.event;

						args.slideshowpaused = !args.slideshowpaused;

						initMenuButtons(menuButtons);

						e.preventDefault();
						e.stopPropagation();
					},
					init: function(menu, display){
						var mButton = getMenuButton("SlidePause"),
							isPlaying = !args.slideshowpaused;

						mButton.style = iconStyleCommon + "background-image: " + (isPlaying? pauseIconUrl: playIconUrl);
						mButton.title = isPlaying? "Pause slideshow": "Resume slideshow";
					}
				});

				menuButtons.push({
					name: "SlideRight",
					title: "Next image",
					style: iconStyleCommon + "background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDE0IDc5LjE1Njc5NywgMjAxNC8wOC8yMC0wOTo1MzowMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTQgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6MkRDRDUxNzlENkM1MTFFNTk1RkZFOUNEQzU0OTAzQzciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6MkRDRDUxN0FENkM1MTFFNTk1RkZFOUNEQzU0OTAzQzciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoyRENENTE3N0Q2QzUxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDoyRENENTE3OEQ2QzUxMUU1OTVGRkU5Q0RDNTQ5MDNDNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PlJl2uMAAAHTSURBVHja5JsxTgQxDEW9vgMdxdwEuAEU2y83wRegowa3S8MNYA9BDTXV3iAkSEgIIUh2JvYPtuQua4+f7L+aSUIpJWrw5+zrxt8s6UfZr7O/pZ/tJvtxS8yW5F9t4wTgMf1tBc5UG3P1QaHOvi+8zH5HdjZlf6lcu8t+WrOQZzzQbfaNMYBaO6ldyDMfqkBY08DGC8TYGncCHACPcYADMCwEXjjecJrAHWIOpQncKe4w48AdYw8BgTvHh9cENsgBrQlslAd2HNgwFyQENs4HpwnskBNKE9gpL8w4sGNuCAjsnN9dExigC101AQGA6zigAHCDgATARRPQAJhrAiIA03FABWAGARmAiSagA+iuCSMA+OyE8x6B52yOotvqP3UARR+BYk+RAWh2iQpAIv8LlOKvomqA9i4eGYBGfhcQCvw2KBZtjwpArYtHAqAU+JugUOCvwuLR9igA1Lt4TwBKgfcGhQLvDgtC23sBULTiLQEoBT4jJBT4lJggtr0VAEUvvicApcBnhYUCnxaXEdq+FwAdrfglASgFvjMkFPjWmIzY9ksBsJ75fcPaXe3CQ7fHvWa+3B2eKtadUeVmaksHlKCvzjN/kf3+l254aCm+2LsAAwA3DecB7XprAwAAAABJRU5ErkJggg==')",
					action: function(e){
						var event = e || window.event;

						args.slideshowindex += 1;
						if(args.slideshowindex > args.slideShowImages.length-1) {
							args.slideshowindex = 0;
						}

						setSlideShowImage(args.slideshowindex);

						e.preventDefault();
						e.stopPropagation();
					}
				});
			}

			initMenuButtons(menuButtons);

			var isMenuShown = false,
				setSlideShowImage = function(idx) {
					//	Replace texture: clear up memory, add texture
					textureLoader.load(args.slideShowImages[idx], function(tex){
						sphereMaterial.map.dispose();
						sphereMaterial.map = tex;
					});
				},
				showCursor = function(){
					args.container.style.cursor = prevStyle.cursor;
				},
				hideCursor = function(){
					prevStyle.cursor = args.container.style.cursor || "initial";
					args.container.style.cursor = "none";
				},
				showMenu = function(){
					//	Only show if enabled, and we have any items in the menuButtons list.
					if(!args.showmenu || menuButtons.length < 1) {
						return;
					}
					clearTimeout(hideMenuTimer);
					if(!isMenuShown) {
						if(args.showmenu && args.container.getElementsByClassName("marbleMenuBox")[0]) {
							args.container.getElementsByClassName("marbleMenuBox")[0].style.opacity = 0.75;
							isMenuShown = true;
						}
						showCursor();
					}
				},
				hideMenu = function(){
					if(isMenuShown) {
						if(args.showmenu) {
							args.container.getElementsByClassName("marbleMenuBox")[0].style.opacity = 0;
							isMenuShown = false;
						}
						hideCursor();
					}
				},
				
				decelerateThreshold = 5,

				//	Apply deceleration
				decelerate = function(diffX, diffY, immediate){
					canceldecelerate = false;
					//	Make sure we've moved enough.
					if(!(Math.abs(diffX) > decelerateThreshold || Math.abs(diffY) > decelerateThreshold)) {
						return;
					}

					//	Deceleration calculation always runs at 60fps
					var frames = 180,
						count = 0,
						decelerateMultiplier = 0.1,
						tweeny = function(count){
							var tween = 1-easeOutCubic(count/frames);
							return {
								horizontal: diffX * tween * decelerateMultiplier,
								vertical: diffY * tween * decelerateMultiplier
							};
						},
						decFunc = function(){
							var t = tweeny(count);
							args.horizontal += t.horizontal;
							args.vertical -= t.vertical;

							count += 1;
							if(count < frames) {
								if(!canceldecelerate) {
									requestAnimationFrame(decFunc);
								}
							}
						};

					//	Calculate the cumulative values
					if(immediate) {
						var result = {
							horizontal: 0,
							vertical: 0
						}, tt;
						for(count = 0; count < frames; count += 1) {
							tt = tweeny(count);
							result.horizontal += tt.horizontal;
							result.vertical += tt.vertical;
						}
						return result;
					} else {
						requestAnimationFrame(decFunc);
					}
				},
				hideMenuOnTimeout = function(){
					if(isPaused && isMenuShown) {
						clearTimeout(hideMenuTimer);
						return;
					}
					if(isMenuShown) {
						clearTimeout(hideMenuTimer);
						hideMenuTimer = setTimeout(function(){
							if(isPaused) {
								return;
							}
							hideMenu();
						}, args.menutimeout);
					}
				},
				addEvents = function(events, func){
					var addSpecificEvent = function(ev, fn) {
						// //	Remove, then add event function
						args.container.removeEventListener(ev, fn, false);
						args.container.addEventListener(ev, fn, false);
					};
					events = events.split(" ");
					for(var i = 0; i < events.length; i += 1) {
						addSpecificEvent(events[i], func);						
					}
				},
				allowOrbitUpdate = function(){
					allowOrbitControls = true;
				},
				disallowOrbitUpdate = function(){
					allowOrbitControls = false;
					hadOrbitControl = true;
				};

			//	If we allow user interaction
			if(args.allowuserinteraction) {
				//	Various events to show the menu on
				addEvents("pointerdown", showMenu);
				addEvents("pointermove", showMenu);
				addEvents("pointerup", showMenu);

				//	Various events to hide the menu on
				addEvents("mouseout", hideMenuOnTimeout);
				addEvents("touchend", hideMenuOnTimeout);
				addEvents("pointermove", hideMenuOnTimeout);




				addEvents('mousedown mousewheel DOMMouseScroll keydown touchstart pointerdown', allowOrbitUpdate);
				addEvents('mouseup keyup touchend pointerup', disallowOrbitUpdate);




			}

			//	Animate the image on startup,
			//	Assuming no other image is active
			if(args.animate) {
				var spinAmount = args.spin * 10;
				args.horizontal -= decelerate(spinAmount, 0, true).horizontal;
				//	Wait rendering engine to start.
				renderReady = function(){
					if(!otherImageActive) {
						decelerate(spinAmount, 0);

						if(args.animatezoom) {
							var anizoom = args.zoommin,
								anizoomend = args.zoom,
								animateZoom = function(){
									anizoom += 2.5 + 1/easeOutCubic(args.zoommin/anizoom + 1)*40/4;

									if(anizoom > anizoomend) {
										anizoom = anizoomend;
									}

									args.zoom = anizoom;
									if(anizoom<anizoomend) {
										requestAnimationFrame(animateZoom);
									}
								};
							requestAnimationFrame(animateZoom);
						}
					}
				};
			}

			//	Basic slideshow
			if(args.slideShowImages && args.slideShowImages.length) {
				slideShowTimer = setInterval(function() {
					if(args.slideshowpaused) {
						return;
					}
					args.slideshowindex += 1;
					if(args.slideshowindex > args.slideShowImages.length-1) {
						args.slideshowindex = 0;
					}

					setSlideShowImage(args.slideshowindex);

				},  args.slideshowdelay);
			}

			//clock = new THREE.Clock();
		};

		//	Grab images for slideshow, if more than one image
		if(!args.imgcube && args.img && args.img.indexOf("|") !== -1) {
			args.slideShowImages = args.slideShowImages || [];
			args.slideShowImages = args.slideShowImages.concat(args.img.split("|"));
			args.img = args.slideShowImages[0];
		}

		//	Add preview image if available, and wait for interaction
		if(args.previewimg) {
			if(window.Detector.webgl && (args.forceinit)) {
				//	If we have webgl, force the init
				init(args);
			} else {
				//	Add an intereact icon
				var interactStyles = [
						'.marbleInteract {'+
						//	Image encoded from: ../icons/interact.png
						"	background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAC8CAYAAACaNleyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpCMkY0N0RFNDdGQkUxMUU1QkE0Q0I1RkE5RTA3QUQ0NCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpCMkY0N0RFNTdGQkUxMUU1QkE0Q0I1RkE5RTA3QUQ0NCI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkIyRjQ3REUyN0ZCRTExRTVCQTRDQjVGQTlFMDdBRDQ0IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkIyRjQ3REUzN0ZCRTExRTVCQTRDQjVGQTlFMDdBRDQ0Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+GAJzTQAATS5JREFUeNrsfQd8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');"+
						'	height: 188px; width: 150px;'+
						'	margin: -75px 0 -94px;'+
						'	cursor: pointer;'+
						'}'
					],
					interactStyleEl = document.createElement('style'),
					interactDivContainer = document.createElement("div"),
					interactDiv = document.createElement("div"),
					previewImg = document.createElement('img'),
					previewClickEvent = function(){
						ready = function(){
							previewImg.parentNode.removeChild(previewImg);
						};
						interactDivContainer.parentNode.removeChild(interactDivContainer);
						args.container.removeEventListener("pointerup", previewClickEvent);
						init(args);
					};

				previewImg.setAttribute("src", args.previewimg);
				previewImg.setAttribute("style", "position: absolute");
				previewImg.className = "marble-preview-image";
				args.container.appendChild(previewImg);

				// Hack: make sure the style sheet works in older WebKits
				interactStyleEl.appendChild(document.createTextNode(""));
				// Add to the page
				document.head.appendChild(interactStyleEl);

				//	Add the interactStyles
				ulib.utils.each(interactStyles, function(i, s){
					interactStyleEl.sheet.insertRule(s, i);
				});

				//	Add the icon and click event as long as WebGL is supported
				//	Otherwise do nothing, and let the preview image show.
				if(window.Detector.webgl) {
					args.container.addEventListener("pointerup", previewClickEvent);
					interactDiv.setAttribute("class", "marbleInteract");
					interactDivContainer.setAttribute("style", "position: absolute; margin: 0 auto; width: 0; top: "+((args.height/2))+"px; left: "+((args.width/2)-75)+"px;");
					interactDivContainer.appendChild(interactDiv);
					args.container.appendChild(interactDivContainer);
				}
			}
		} else {
			init(args);
		}

		//	So we only init once
		dataset(args.container, marbleready, "true");

		//	Expose args
		//	TODO: add methods for manipulating this instance
		args.container.marble = {
			args: args,
			forceRender: forceRender,
			dispose: dispose
		};
	};
}

//	Add image directly
var tmpScript = document.getElementsByTagName('script'),
	scriptParams = dataset(tmpScript[tmpScript.length -1]),
	params,
	unobtrusive,
	makeImgBox = function(params, target){
		var imgBox = document.createElement("div"),
			id = "marble_" + (new Date()).getTime() + (Math.random()),
			i;

		//	Add data attributes
		for(i in params) {if(params.hasOwnProperty(i)){
			dataset(imgBox, i, params[i]);
		}}

		imgBox.setAttribute("id", id);

		if(target) {
			//	Append to the target
			target.appendChild(imgBox);
		} else {
			//	Write the container div into the document
			/*jshint -W060 */
			document.write(imgBox.outerHTML);
			/*jshint +W060 */
		}

		return document.getElementById(id);
	},
	targetNode,
	i;


//	If we're appending to the script
if (typeof scriptParams.img !== "undefined"){
	//	Set it up
	win.marble.init(makeImgBox(scriptParams));

	//	So we only init once
	dataset(tmpScript[tmpScript.length-1], marbleready, "true");
}

//	Add any unobtrusive initilisations
unobtrusive = document.querySelectorAll('[data-img]');

for(i in unobtrusive) {if(unobtrusive.hasOwnProperty(i)){
	if(unobtrusive[i] && typeof unobtrusive[i].nodeType !== "undefined") {
		params = dataset(unobtrusive[i]);
		if(!params.marbleready) {
			targetNode = unobtrusive[i].parentNode;
			targetNode.removeChild(unobtrusive[i]);

			//	Add new node and init
			win.marble.init(makeImgBox(params, targetNode));
		}
	}
}}

}(window));
