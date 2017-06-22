/**
 * @author richt / http://richt.me
 * @author WestLangley / http://github.com/WestLangley
 *
 * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
 */

THREE.DeviceOrientationControls = function( object ) {

	var scope = this;

	this.object = object;
	this.object.rotation.reorder( "YXZ" );

	this.enabled = true;

	this.deviceOrientation = {};
	this.screenOrientation = 0;

	this.alpha = 0;
	this.alphaOffsetAngle = 0;



function Quat2Angle( x, y, z, w ) {

    var pitch, roll, yaw;

    var test = x * y + z * w;
    if (test > 0.499) { // singularity at north pole
        yaw = 2 * Math.atan2(x, w);
        pitch = Math.PI / 2;
        roll = 0;

        var euler = new THREE.Vector3( pitch, roll, yaw);
        return euler;
    }
    if (test < -0.499) { // singularity at south pole
        yaw = -2 * Math.atan2(x, w);
        pitch = -Math.PI / 2;
        roll = 0;
        var euler = new THREE.Vector3( pitch, roll, yaw);
        return euler;
    }
    var sqx = x * x;
    var sqy = y * y;
    var sqz = z * z;
    yaw = Math.atan2(2 * y * w - 2 * x * z, 1 - 2 * sqy - 2 * sqz);
    pitch = Math.asin(2 * test);
    roll = Math.atan2(2 * x * w - 2 * y * z, 1 - 2 * sqx - 2 * sqz);

    var euler = new THREE.Vector3( pitch, roll, yaw);
    return euler;
}

	var onDeviceOrientationChangeEvent = function( event ) {
		scope.deviceOrientation = event;
	};

	var onScreenOrientationChangeEvent = function() {
		scope.screenOrientation = window.orientation || 0;
	};

	// The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

	var setObjectQuaternion = function() {
		var zee = new THREE.Vector3( 0, 0, 1 );
		var euler = new THREE.Euler();
		var q0 = new THREE.Quaternion();
		var q1 = new THREE.Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

		return function( quaternion, alpha, beta, gamma, orient ) {
			euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us
			quaternion.setFromEuler( euler ); // orient the device
			quaternion.multiply( q1 ); // camera looks out the back of the device, not the top
			quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation
		};
	}();

	this.connect = function() {
		onScreenOrientationChangeEvent(); // run once on load

		window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = true;
	};

	this.disconnect = function() {
		window.removeEventListener( 'orientationchange', onScreenOrientationChangeEvent, false );
		window.removeEventListener( 'deviceorientation', onDeviceOrientationChangeEvent, false );

		scope.enabled = false;
	};

	this.update = function(updateFromMatrix) {
		if ( scope.enabled === false ) return;

		var alpha = scope.deviceOrientation.alpha ? THREE.Math.degToRad( scope.deviceOrientation.alpha ) + this.alphaOffsetAngle : 0; // Z
		var beta = scope.deviceOrientation.beta ? THREE.Math.degToRad( scope.deviceOrientation.beta ) : 0; // X'
		var gamma = scope.deviceOrientation.gamma ? THREE.Math.degToRad( scope.deviceOrientation.gamma ) : 0; // Y''
		var orient = scope.screenOrientation ? THREE.Math.degToRad( scope.screenOrientation ) : 0; // O

		//	Update from the matrix
		if(updateFromMatrix) {


			//	Grrr GRR GRRRRRRR!!! This should be easy - simply update from the orbit controsl, ARGH!


			/*
			//console.log('Apply matrix', matrix.elements);
			//console.log('scope.deviceOrientation', scope.deviceOrientation);
			scope.object.quaternion.setFromRotationMatrix (matrix);


	        var currentQ = new THREE.Quaternion().copy(scope.object.quaternion);
	        currentQ.

        	setObjectQuaternion(currentQ, alpha, beta, gamma, orient);
    	    var currentAngle = Quat2Angle(currentQ.x, currentQ.y, currentQ.z, currentQ.w);

    	    console.log('currentAngle', currentAngle);
*/

			scope.object.quaternion.setFromRotationMatrix(scope.object.matrixWorldInverse, "YXZ", true);

			console.log('SET FROM:', scope.object);

			scope.deviceOrientation = {};

		} else {

			setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );
		}
		this.alpha = alpha;
	};

	this.updateAlphaOffsetAngle = function( angle ) {

		this.alphaOffsetAngle = angle;
		this.update();

	};

	this.dispose = function() {

		this.disconnect();

	};

	this.connect();

};