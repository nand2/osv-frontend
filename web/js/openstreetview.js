function OpenStreetView (params) {
  var instance = this;
  var debug = true;

  // Pics data
  var picsData = {};

  // Three.js elements
  var domElement = null;
  var threeRenderer = null;
  var threeCamera = null;
  var threeGeometry = null;
  var threeMaterial = null;
  var threeMesh = null;
  var threeScene = null;

  // Camera
  var lon = 0, onMouseDownLon = 0,
  lat = 0, onMouseDownLat = 0,
  phi = 0, theta = 0;
  var isUserInteracting = false;

  var defaults = {
    // The DOM element receiving the viewer
    target: 'openstreetview',
    // The viewer dimension
    width: 640,
    height: 480
  };

  // Merge default with params
  params = merge(defaults, params);

  // Init the viewer
  initViewer();
  renderingLoop();


  /**
   * Add a picture into our library
   */
  this.addPicture = function(picData) {
    picsData[picData.id] = picData;
  };

  /**
   * Get all the pictures data
   */
  this.getPictures = function() {
    return picsData;
  }

  /**
   * Show a specific picture
   */
  this.showPicture = function(id) {
    var pic = picsData[id];

    threeScene = new THREE.Scene();

    var threeGeometry = new THREE.SphereGeometry( 500, 60, 40 );
    threeGeometry.scale( - 1, 1, 1 );

    var threeMaterial = new THREE.MeshBasicMaterial( {
        map: THREE.ImageUtils.loadTexture(pic.url)
    });

    threeMesh = new THREE.Mesh( threeGeometry, threeMaterial );
    
    threeScene.add( threeMesh );
  }

  // Init the three renderer
  function initViewer() {
    domElement = document.getElementById(params.target);

    threeCamera = new THREE.PerspectiveCamera( 75, params.width / params.height, 1, 1100);
    threeCamera.target = new THREE.Vector3( 0, 0, 0 );

    threeScene = new THREE.Scene();

    var threeGeometry = new THREE.SphereGeometry( 500, 60, 40 );
    threeGeometry.scale( - 1, 1, 1 );

    var threeMaterial = new THREE.MeshBasicMaterial( {
        map: THREE.ImageUtils.loadTexture('img/1.jpg')
    });

    threeMesh = new THREE.Mesh( threeGeometry, threeMaterial );
    
    threeScene.add( threeMesh );

    threeRenderer = new THREE.WebGLRenderer();
    threeRenderer.setPixelRatio(window.devicePixelRatio);
    threeRenderer.setSize(params.width, params.height);
    domElement.appendChild(threeRenderer.domElement);    

    // Setup the controls
    domElement.addEventListener( 'mousedown', onMouseDown, false );
    domElement.addEventListener( 'mousemove', onMouseMove, false );
    domElement.addEventListener( 'mouseup', onMouseUp, false );
    domElement.addEventListener( 'mousewheel', onMouseWheel, false );
    domElement.addEventListener( 'MozMousePixelScroll', onMouseWheel, false);
  }

  // The rendering loop
  function renderingLoop() {
      requestAnimationFrame(renderingLoop);
      render();
  }

  // The main rendering loop
  function render() {
      lat = Math.max(-85, Math.min(85, lat));
      phi = THREE.Math.degToRad(90 - lat);
      theta = THREE.Math.degToRad(lon);

      threeCamera.target.x = 500 * Math.sin(phi) * Math.cos(theta);
      threeCamera.target.y = 500 * Math.cos(phi);
      threeCamera.target.z = 500 * Math.sin(phi) * Math.sin(theta);

      threeCamera.lookAt(threeCamera.target);

      /*
      // distortion
      camera.position.copy( camera.target ).negate();
      */

      threeRenderer.render(threeScene, threeCamera);
  }

  function onMouseDown(event) {
      event.preventDefault();
      isUserInteracting = true;

      onPointerDownPointerX = event.clientX;
      onPointerDownPointerY = event.clientY;

      onPointerDownLon = lon;
      onPointerDownLat = lat;
  }

  function onMouseMove(event) {
      if ( isUserInteracting === true ) {
          lon = ( onPointerDownPointerX - event.clientX ) * 0.1 + onPointerDownLon;
          lat = ( event.clientY - onPointerDownPointerY ) * 0.1 + onPointerDownLat;
      }
  }

  function onMouseUp(event) {
      isUserInteracting = false;
  }

  function onMouseWheel(event) {
      // WebKit
      if (event.wheelDeltaY) {
          threeCamera.fov -= event.wheelDeltaY * 0.05;
      // Opera / Explorer 9
      } else if (event.wheelDelta) {
          threeCamera.fov -= event.wheelDelta * 0.05;
      // Firefox
      } else if (event.detail) {
          threeCamera.fov += event.detail * 0.05;
      }

      threeCamera.updateProjectionMatrix();

      event.preventDefault();
  }

  // Prints a log message if in debug mode and console is available
  function log(message) {
    if (window.console && debug) {
      console.log(message);
    }
  }
  
  // Merge objects together - from Secrets fo the JavaScript Ninja
  function merge(root) {
    for (var i = 1; i < arguments.length; i++) {
      for (var key in arguments[i]) {
        root[key] = arguments[i][key];
      }
    }
    return root;
  }
}