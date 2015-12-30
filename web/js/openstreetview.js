function OpenStreetView (params) {
  var instance = this;
  var debug = true;

  // Pics data
  var picsData = {};
  var currentPicId;
  var picsTexture = {};

  // Three.js elements
  var domElement = null;
  var threeRenderer = null;
  var threeCamera = null;
  var threeGeometry = null;
  var threeMaterial = null;
  var threeSphere = null;
  var arrowMesh = null;
  var threeArrows = [];
  var threeScene = null;
  var threeRaycaster = null;
  var threeJsonLoader = null;

  // Camera
  var lon = 0, onMouseDownLon = 0,
  lat = 0, onMouseDownLat = 0,
  phi = 0, theta = 0;
  var isUserInteracting = false;
  var initTime = null;

  var defaults = {
    // The DOM element receiving the viewer
    target: 'openstreetview',
    // The viewer dimension
    width: 640,
    height: 480,
    hint360: false
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

    if(picData.id == instance.currentPicId) {
      showPictureArrows();
    }
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
    instance.currentPicId = id;

    var threeMaterial = new THREE.MeshBasicMaterial( {
        map: getPictureTexture(id)
    });
    threeSphere.material.dispose();
    threeSphere.material = threeMaterial;

    // Picture angle correction
    threeSphere.rotation.x = pic.correction.rotation.x * Math.PI / 180;
    threeSphere.rotation.y = pic.correction.rotation.y * Math.PI / 180;
    threeSphere.rotation.z = pic.correction.rotation.z * Math.PI / 180;

    showPictureArrows();
  }

  // Show/update the arrows
  function showPictureArrows() {
    var pic = picsData[instance.currentPicId];

    if(pic == undefined) {
      return;
    }

    // Removing current arrows
    while(arrow = threeArrows.pop()) {
      threeScene.remove(arrow);
    }

    // Adding new ones
    if(pic.neighbors) {
      for(var i = 0; i < pic.neighbors.length; i++) {
        arrowModel = new THREE.Object3D();
        arrowModel.add(arrowMesh.clone());

        // Orientation
        angle = pic.neighbors[i].angle * Math.PI / 180;
        arrowModel.position.set(4 * Math.cos(angle), -2, -4 * Math.sin(angle));
        arrowModel.rotateY(angle);

        // Attach infos
        arrowModel.userData.picId = pic.neighbors[i].id;

        threeScene.add(arrowModel);
        threeArrows.push(arrowModel);
      }
    }
  }

  // Fetch or reuse an image
  function getPictureTexture(picId) {
    var pic = picsData[picId];

    if(pic == undefined) {
      return null;
    }

    if(picsTexture[picId]) {
      return picsTexture[picId];
    }

    picsTexture[picId] = THREE.ImageUtils.loadTexture(pic.url);
    return picsTexture[picId];
  }

  // Init the three renderer
  function initViewer() {
    domElement = document.getElementById(params.target);
    domElement.className = domElement.className + " openstreetview";

    threeCamera = new THREE.PerspectiveCamera( 75, params.width / params.height, 0.1, 1100);
    threeCamera.target = new THREE.Vector3( 0, 0, 0 );

    threeScene = new THREE.Scene();

    var threeGeometry = new THREE.SphereGeometry( 500, 60, 40 );
    threeGeometry.scale( - 1, 1, 1 );

    // TODO
    var threeMaterial = new THREE.MeshBasicMaterial( {
        map: THREE.ImageUtils.loadTexture('img/1.jpg')
    });
    instance.currentPicId = 1;

    threeSphere = new THREE.Mesh( threeGeometry, threeMaterial );
    
    threeScene.add( threeSphere );

    threeRenderer = new THREE.WebGLRenderer({ antialias: true });
    threeRenderer.setPixelRatio(window.devicePixelRatio);
    threeRenderer.setSize(params.width, params.height);
    domElement.appendChild(threeRenderer.domElement);    

    // initialize raycaster
    threeRaycaster = new THREE.Raycaster()

    // Initialize JSON model loader
    threeJsonLoader = new THREE.JSONLoader();

    // load the arrow model
    threeJsonLoader.load(
      // resource URL
      'models/arrow.json',
      // Function when resource is loaded
      function ( geometry, materials ) {
        //var material = new THREE.MeshFaceMaterial( materials );
        material = new THREE.MeshBasicMaterial({
          // wireframe: true,
          // wireframeLinewidth: 2,
          color: '#1e72a3',
          opacity: 0.8,
          transparent: true
        });
        arrowMesh = new THREE.Mesh(geometry, material);
        
        showPictureArrows();
      }
    );

    // Setup the controls
    domElement.addEventListener( 'mousedown', onMouseDown, false);
    window.addEventListener( 'mousemove', onMouseMove, false);
    window.addEventListener( 'mouseup', onMouseUp, false );
    domElement.addEventListener( 'mousewheel', onMouseWheel, false);
    domElement.addEventListener( 'MozMousePixelScroll', onMouseWheel, false);

    initTime = new Date();
  }

  // The rendering loop
  function renderingLoop() {
      requestAnimationFrame(renderingLoop);
      render();
  }

  // The main rendering loop
  function render() {
      // A 360 hint, to show that you can drag the picture around
      if(params.hint360) {
        var timediff = new Date() - initTime;
        if(timediff < 4000) {
          lon += 0.2 * (4000 - timediff) / 4000;
        }
      }

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

      //
      // Prepare for camera moving with mouse DnD
      //
      onPointerDownPointerX = event.clientX;
      onPointerDownPointerY = event.clientY;
      onPointerDownLon = lon;
      onPointerDownLat = lat;


      //
      // Find out if we got a directional arrow clicked
      //
      // Local 2D x/y cursor position
      var rect = domElement.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;

      // Convert into a 3D cursor, x:(-1,1), y:(-1,1)
      var mouse = new THREE.Vector3(
        (x / params.width) * 2 - 1,
        -(y / params.height) * 2 + 1,
        0.5
      );  

      // Raycast and get the intersected arrows
      threeRaycaster.setFromCamera(mouse, threeCamera);
      var intersects = threeRaycaster.intersectObjects(threeArrows, true);
      
      // if an arrow is clicked, we navigate
      if(intersects.length > 0)
      {
        instance.showPicture(intersects[0].object.parent.userData.picId);
        // change the color of the closest face.
        // intersects[ 0 ].face.color.setRGB( 0.8 * Math.random() + 0.2, 0, 0 ); 
        // intersects[ 0 ].object.geometry.colorsNeedUpdate = true;
      }
  }

  function onMouseMove(event) {
      if ( isUserInteracting === true ) {
          lon = (onPointerDownPointerX - event.clientX) * 0.1 + onPointerDownLon;
          lat = (event.clientY - onPointerDownPointerY) * 0.1 + onPointerDownLat;
      }
  }

  function onMouseUp(event) {
      isUserInteracting = false;
  }

  function onMouseWheel(event) {
      var fovMax = 80;
      var fovMin = 20;

      var newFov = 0;
      // WebKit
      if (event.wheelDeltaY) {
          newFov = threeCamera.fov - event.wheelDeltaY * 0.05;
      // Opera / Explorer 9
      } else if (event.wheelDelta) {
          newFov = threeCamera.fov - event.wheelDelta * 0.05;
      // Firefox
      } else if (event.detail) {
          newFov = threeCamera.fov + event.detail * 0.05;
      }

      if(fovMin < newFov && newFov < fovMax) {
        threeCamera.fov = newFov;
        threeCamera.updateProjectionMatrix();
      }

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