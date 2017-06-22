// NOTE: This is a modified version of this GIST: https://gist.github.com/mrflix/8351020

/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 * @author mrflix / http://felixniklas.de
 * 
 * released under MIT License (MIT)
 */
/*global THREE, console */

// This set of controls performs orbiting, dollying (zooming), and panning. It maintains
// the "up" direction as +Y, unlike the TrackballControls. Touch on tablet and phones is
// supported.
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finter swipe
//
// This is a drop-in replacement for (most) TrackballControls used in examples.
// That is, include this js file and wherever you see:
//    	controls = new THREE.TrackballControls( camera );
//      controls.target.z = 150;
// Simple substitute "OrbitControls" and the control should work as-is.

THREE.OrbitControls = function ( object, domElement, localElement ) {

	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;
	this.localElement = ( localElement !== undefined ) ? localElement : document;

	// API

	// Set to false to disable this control
	this.enabled = true;

	// "target" sets the location of focus, where the control orbits around
	// and where it pans with respect to.
	this.target = new THREE.Vector3();
	// center is old, deprecated; use "target" instead
	this.center = this.target;

	// This option actually enables dollying in and out; left as "zoom" for
	// backwards compatibility
	this.noZoom = false;
	this.zoomSpeed = 1.0;
	// Limits to how far you can dolly in and out
	this.minDistance = 0;
	this.maxDistance = Infinity;

	// Set to true to disable this control
	this.noRotate = false;
	this.rotateSpeed = 0.5;//1.0;

	// Set to true to disable this control
	this.noPan = false;
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// Set to true to automatically rotate around the target
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	// How far you can orbit vertically, upper and lower limits.
	// Range is 0 to Math.PI radians.
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI; // radians

	// Set to true to disable use of the keys
	this.noKeys = false;
	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Set to true to invert the direction the controls spin the viewpoint
	this.invertControls = false;

	// Set to true to decelerate the spin when done moving.
	this.decelerateSpin = true;

	////////////
	// internals

	var scope = this;

	var EPS = 0.000001;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	var phiDelta = 0;
	var thetaDelta = 0;
	var minRadius = 0.001;
	var maxRadius = 400;
	var radius = minRadius;
	var pan = new THREE.Vector3();

	var lastPosition = new THREE.Vector3();

	var STATE = { NONE : -1, ROTATE : 0, DOLLY : 1, PAN : 2, TOUCH_ROTATE : 3, TOUCH_DOLLY : 4, TOUCH_PAN : 5 };
	var state = STATE.NONE;

	var diffLeft;
	var diffUp;
	var prevLeft;
	var prevUp;
	var canceldecelerate = false;
	var decelerateThreshold = 0.5;

	// events

	var changeEvent = { type: 'change' };


	this.rotateLeft = function ( angle, movement ) {

		if ( angle === undefined ) {

			angle = getAutoRotationAngle();

		}

		if(movement) {
			diffLeft = prevLeft - movement.x;
			prevLeft = movement.x;
		}

		thetaDelta += scope.invertControls? -angle: angle;

	};

	this.rotateUp = function ( angle, movement ) {

		if ( angle === undefined ) {

			angle = getAutoRotationAngle();

		}

		if(movement) {
			diffUp = prevUp - movement.y;
			prevUp = movement.y;
		}

		phiDelta += scope.invertControls? -angle: angle;

	};

	// pass in distance in world space to move left
	this.panLeft = function ( distance ) {

		var panOffset = new THREE.Vector3();
		var te = this.object.matrix.elements;
		// get X column of matrix
		panOffset.set( te[0], te[1], te[2] );
		panOffset.multiplyScalar(-distance);
		
		pan.add( panOffset );

	};

	// pass in distance in world space to move up
	this.panUp = function ( distance ) {

		var panOffset = new THREE.Vector3();
		var te = this.object.matrix.elements;
		// get Y column of matrix
		panOffset.set( te[4], te[5], te[6] );
		panOffset.multiplyScalar(distance);
		
		pan.add( panOffset );
	};
	
	// main entry point; pass in Vector2 of change desired in pixel space,
	// right and down are positive
	this.pan = function ( delta ) {

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		if ( scope.object.fov !== undefined ) {

			// perspective
			var position = scope.object.position;
			var offset = position.clone().sub( scope.target );
			var targetDistance = offset.length();

			// half of the fov is center to top of screen
			targetDistance *= Math.tan( (scope.object.fov/2) * Math.PI / 180.0 );
			// we actually don't use screenWidth, since perspective camera is fixed to screen height
			scope.panLeft( 2 * delta.x * targetDistance / element.clientHeight );
			scope.panUp( 2 * delta.y * targetDistance / element.clientHeight );

		} else if ( scope.object.top !== undefined ) {

			// orthographic
			scope.panLeft( delta.x * (scope.object.right - scope.object.left) / element.clientWidth );
			scope.panUp( delta.y * (scope.object.top - scope.object.bottom) / element.clientHeight );

		} else {

			// camera neither orthographic or perspective - warn user
			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );

		}

	};

	var radiusStep = 4,
		moveDollyIn = function(){
			radius -= radiusStep;
			radius = radius < minRadius? minRadius: radius;
		},
		moveDollyOut = function(){
			radius += radiusStep;
			radius = radius > maxRadius? maxRadius: radius;
		};

	this.dollyIn = function () {
		if(scope.invertControls) {
			moveDollyIn();
		} else {
			moveDollyOut();
		}
	};

	this.dollyOut = function () {
		if(scope.invertControls) {
			moveDollyOut();
		} else {
			moveDollyIn();
		}
	};

	this.update = function () {

		var position = this.object.position;
		var offset = position.clone().sub( this.target );

		// angle from z-axis around y-axis
		var theta = Math.atan2( offset.x, offset.z );
		// angle from y-axis
		var phi = Math.atan2( Math.sqrt( offset.x * offset.x + offset.z * offset.z ), offset.y );

		if ( this.autoRotate ) {
			this.rotateLeft( getAutoRotationAngle() );
		}

		theta += thetaDelta;
		phi += phiDelta;

		// restrict phi to be between desired limits
		phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );

		// restrict phi to be betwee EPS and PI-EPS
		phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );

		// restrict radius to be between desired limits
		radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );
		
		// move target to panned location
		this.target.add( pan );

		offset.x = radius * Math.sin( phi ) * Math.sin( theta );
		offset.y = radius * Math.cos( phi );
		offset.z = radius * Math.sin( phi ) * Math.cos( theta );

		position.copy( this.target ).add( offset );

		this.object.lookAt( this.target );

		thetaDelta = 0;
		phiDelta = 0;
		pan.set(0,0,0);

		if ( lastPosition.distanceTo( this.object.position ) > 0 ) {
			this.dispatchEvent( changeEvent );
			lastPosition.copy( this.object.position );
		}
	};


	function getAutoRotationAngle() {
		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
	}

	function onMouseDown( event ) {

		if ( scope.enabled === false ) { return; }
		event.preventDefault();

		if ( event.button === 0 ) {
			if ( scope.noRotate === true ) { return; }

			state = STATE.ROTATE;

			rotateStart.set( event.clientX, event.clientY );

		} else if ( event.button === 1 ) {
			if ( scope.noZoom === true ) { return; }

			state = STATE.DOLLY;

			dollyStart.set( event.clientX, event.clientY );

		} else if ( event.button === 2 ) {
			if ( scope.noPan === true ) { return; }

			state = STATE.PAN;

			panStart.set( event.clientX, event.clientY );

		}

		// Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
		scope.domElement.addEventListener( 'mousemove', onMouseMove, false );
		scope.domElement.addEventListener( 'mouseup', onMouseUp, false );

	}

	function onMouseMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		canceldecelerate = true;

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		if ( state === STATE.ROTATE ) {

			if ( scope.noRotate === true ) return;

			rotateEnd.set( event.clientX, event.clientY );
			rotateDelta.subVectors( rotateEnd, rotateStart );

			var leftValue = 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed,
				rightValue = 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed;

			// rotating across whole screen goes 360 degrees around
			scope.rotateLeft( leftValue, {x: event.clientX, y: event.clientY} );
			// rotating up and down along whole screen attempts to go 360, but limited to 180
			scope.rotateUp( rightValue, {x: event.clientX, y: event.clientY} );

			rotateStart.copy( rotateEnd );

		} else if ( state === STATE.DOLLY ) {

			if ( scope.noZoom === true ) return;

			dollyEnd.set( event.clientX, event.clientY );
			dollyDelta.subVectors( dollyEnd, dollyStart );

			if ( dollyDelta.y > 0 ) {
				scope.dollyIn();
			} else {
				scope.dollyOut();
			}

			dollyStart.copy( dollyEnd );

		} else if ( state === STATE.PAN ) {

			if ( scope.noPan === true ) return;

			panEnd.set( event.clientX, event.clientY );
			panDelta.subVectors( panEnd, panStart );
			
			scope.pan( panDelta );

			panStart.copy( panEnd );

		}

		// Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
		scope.update();

	}


	//	Ref: https://gist.github.com/gre/1650294
	function easeOutCubic(t) { return (--t)*t*t+1; };

	//	Apply deceleration
	function decelerate(diffX, diffY, immediate){
		var divisor = 50;

		//	Make sure we've moved enough.
		if(!(Math.abs(diffX) > decelerateThreshold || Math.abs(diffY) > decelerateThreshold)) {
			return;
		}

		diffX = diffX/divisor;
		diffY = diffY/divisor;

		canceldecelerate = false;

		//	Deceleration calculation always runs at 60fps
		var frames = 120,
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
				thetaDelta = -(t.horizontal);
				phiDelta = -(t.vertical);

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
				thetaDelta = -tt.horizontal;
				phiDelta = -tt.vertical;
			}
			return result;
		} else {
			requestAnimationFrame(decFunc);
		}
	};

	function onMouseUp( /* event */ ) {

		if ( scope.enabled === false ) return;

		// Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
		scope.domElement.removeEventListener( 'mousemove', onMouseMove, false );
		scope.domElement.removeEventListener( 'mouseup', onMouseUp, false );

		state = STATE.NONE;

		if(scope.decelerateSpin) {
			decelerate(diffLeft, diffUp);
		}

	}

	function onMouseWheel( event ) {
		if ( scope.enabled === false || scope.noZoom === true ) return;

		var delta = 0;

		if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9
			delta = event.wheelDelta;
		} else if ( event.detail ) { // Firefox
			delta = - event.detail;
		}

		if ( delta > 0 ) {
			scope.dollyOut();
		} else {
			scope.dollyIn();
		}
	}

	function onKeyDown( event ) {

		if ( scope.enabled === false ) { return; }
		if ( scope.noKeys === true ) { return; }
		if ( scope.noPan === true ) { return; }

		// pan a pixel - I guess for precise positioning?
		// Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
		var needUpdate = false;
		
		switch ( event.keyCode ) {

			case scope.keys.UP:
				scope.pan( new THREE.Vector2( 0, scope.keyPanSpeed ) );
				needUpdate = true;
				break;
			case scope.keys.BOTTOM:
				scope.pan( new THREE.Vector2( 0, -scope.keyPanSpeed ) );
				needUpdate = true;
				break;
			case scope.keys.LEFT:
				scope.pan( new THREE.Vector2( scope.keyPanSpeed, 0 ) );
				needUpdate = true;
				break;
			case scope.keys.RIGHT:
				scope.pan( new THREE.Vector2( -scope.keyPanSpeed, 0 ) );
				needUpdate = true;
				break;
		}

		// Greggman fix: https://github.com/greggman/three.js/commit/fde9f9917d6d8381f06bf22cdff766029d1761be
		if ( needUpdate ) {

			scope.update();

		}

	}
	
	function touchstart( event ) {

		if ( scope.enabled === false ) { return; }

		switch ( event.touches.length ) {

			case 1:	// one-fingered touch: rotate
				if ( scope.noRotate === true ) { return; }

				state = STATE.TOUCH_ROTATE;

				rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;

			case 2:	// two-fingered touch: dolly
				if ( scope.noZoom === true ) { return; }

				state = STATE.TOUCH_DOLLY;

				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				var distance = Math.sqrt( dx * dx + dy * dy );
				dollyStart.set( 0, distance );
				break;

			case 3: // three-fingered touch: pan
				if ( scope.noPan === true ) { return; }

				state = STATE.TOUCH_PAN;

				panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				break;

			default:
				state = STATE.NONE;

		}
	}

	function touchmove( event ) {

		if ( scope.enabled === false ) { return; }

		event.preventDefault();
		event.stopPropagation();

		canceldecelerate = true;

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		switch ( event.touches.length ) {

			case 1: // one-fingered touch: rotate
				if ( scope.noRotate === true ) { return; }
				if ( state !== STATE.TOUCH_ROTATE ) { return; }

				rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				rotateDelta.subVectors( rotateEnd, rotateStart );

				var leftValue = 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed,
					rightValue = 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed;

				// rotating across whole screen goes 360 degrees around
				scope.rotateLeft( leftValue, {x: event.touches[ 0 ].pageX, y: event.touches[ 0 ].pageY} );
				// rotating up and down along whole screen attempts to go 360, but limited to 180
				scope.rotateUp( rightValue, {x: event.touches[ 0 ].pageX, y: event.touches[ 0 ].pageY} );

				rotateStart.copy( rotateEnd );
				break;

			case 2: // two-fingered touch: dolly
				if ( scope.noZoom === true ) { return; }
				if ( state !== STATE.TOUCH_DOLLY ) { return; }

				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				var distance = Math.sqrt( dx * dx + dy * dy );

				dollyEnd.set( 0, distance );
				dollyDelta.subVectors( dollyEnd, dollyStart );

				if ( dollyDelta.y > 0 ) {
					scope.dollyOut();
				} else {
					scope.dollyIn();
				}

				dollyStart.copy( dollyEnd );
				break;

			case 3: // three-fingered touch: pan
				if ( scope.noPan === true ) { return; }
				if ( state !== STATE.TOUCH_PAN ) { return; }

				panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
				panDelta.subVectors( panEnd, panStart );
				
				scope.pan( panDelta );

				panStart.copy( panEnd );
				break;

			default:
				state = STATE.NONE;

		}

	}

	function touchend( /* event */ ) {

		if ( scope.enabled === false ) { return; }

		state = STATE.NONE;

		if(scope.decelerateSpin) {
			decelerate(diffLeft, diffUp);
		}
	}

	this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
	this.localElement.addEventListener( 'mousedown', onMouseDown, false );
	this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
	this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox

	this.domElement.addEventListener( 'keydown', onKeyDown, false );

	this.localElement.addEventListener( 'touchstart', touchstart, false );
	this.domElement.addEventListener( 'touchend', touchend, false );
	this.domElement.addEventListener( 'touchmove', touchmove, false );

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );