/**
 * The bridge between the OSM map and the OSV viewer
 */
function OpenStreetView(map_arg, osvp_arg, params) {
  this.debug = true;
  this.debugClosestGeometryLine = null;
  this.debugClosestGeometryPoint = null;
  this.debugClosestPointLine = null;

  // OSM elements
  this.map = null;
  this.vectorSource = null;
  this.positionPoint = new ol.geom.Point([0,0]);

  // Our pane
  this.osvp = null;


  var defaults = {
    positionPointStyle: new ol.style.Circle({
      radius: 10,
      fill: new  ol.style.Fill({
        color: 'rgba(255, 153, 51,0.5)'
      }),
      stroke: new ol.style.Stroke({
        color: 'rgba(255, 153, 51,0.9)',
        width: 2
      })
    })
  };

  // Merge default with params
  this.params = this.merge(defaults, params);

  this.map = map_arg;
  this.osvp = osvp_arg;

  this.init();
}

OpenStreetView.prototype = {
  constructor: OpenStreetView,

  init: function() {
    var style = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: [0, 0, 255, 0.5],
        width: 5
      })
    });

    var geoJSONFormat = new ol.format.GeoJSON();
    vectorSource = new ol.source.Vector({
      format: new ol.format.GeoJSON(),
      url: function(extent, resolution, projection) {
        return 'osv.geojson?bbox=' + extent.join(',') + ',EPSG:3857';
      },
      strategy: ol.loadingstrategy.bbox
    });
    vectorSource.on('change', function() {
      // Send all the picture data to the OpenStreetView instance
      vectorSource.forEachFeature(function(feature) {
        osvData = feature.get("openstreetview");
        if(osvData) {
          for(var i = 0; i < osvData.pics.length; i++) {
            this.osvp.addPicture(osvData.pics[i]);
          }
        }
      }, this);

      // If no picture shown yet, display the first one
      if(this.osvp.getDisplayedPictureId() == null) {
        this.osvp.showPicture(1);
      }
    }, this);

    var osvLayer = new ol.layer.Vector({
      source: vectorSource,
      style: style
    });

    this.map.addLayer(osvLayer);

    // On click on the map, display the closest available pic
    this.map.on('click', function(e) {
      this.displayPicSnap(e.coordinate);
    }, this);

    // On navigation on the OSV viewer, update our location point
    this.osvp.on('navigate', function(e) {
      var picsData = this.osvp.getPictures();
      var picData = picsData[e.newPicId];
      this.positionPoint.setCoordinates(ol.proj.fromLonLat([picData.coordinates.lon, picData.coordinates.lat]));
      this.map.render();
    }, this);

    // On map draw, draw the current position
    this.map.on('postcompose', function(evt) {
      var vectorContext = evt.vectorContext;
      vectorContext.setImageStyle(this.params.positionPointStyle);
      vectorContext.drawPointGeometry(this.positionPoint);
    }, this);            

    if(this.debug) {
      var imageStyle = new ol.style.Circle({
        radius: 5,
        fill: null,
        stroke: new ol.style.Stroke({
          color: 'rgba(255,0,0,0.9)',
          width: 1
        })
      });
      var strokeStyle = new ol.style.Stroke({
        color: 'rgba(255,0,0,0.9)',
        width: 1
      });
      this.map.on('postcompose', function(evt) {
        var vectorContext = evt.vectorContext;
        if (this.debugClosestGeometryPoint !== null) {
          vectorContext.setImageStyle(imageStyle);
          vectorContext.drawPointGeometry(this.debugClosestGeometryPoint);
        }
        if (this.debugClosestGeometryLine !== null) {
          vectorContext.setFillStrokeStyle(null, strokeStyle);
          vectorContext.drawLineStringGeometry(this.debugClosestGeometryLine);
        }
        if (this.debugClosestPointLine !== null) {
          vectorContext.setFillStrokeStyle(null, strokeStyle);
          vectorContext.drawLineStringGeometry(this.debugClosestPointLine);
        }
      }, this);
    }
  },


  /**
   * Show the pic closest to the given coordinates
   */
  displayPicSnap: function(coordinate) {
    // Get the closest line of pics
    var closestFeature = vectorSource.getClosestFeatureToCoordinate(coordinate);
    if (closestFeature != null) {
      // Get the closest point in the line of pics
      var geometry = closestFeature.getGeometry();
      var closestGeometryPoint = geometry.getClosestPoint(coordinate);

      // Get the closest actual pic on the line of pics
      var coordinates = geometry.getCoordinates();
      var closestCoordinateId = 0;
      var minDistance = this.distanceBetweenPoints(closestGeometryPoint, coordinates[0]);
      for(var i = 1; i < coordinates.length; i++) {
        var distance = this.distanceBetweenPoints(closestGeometryPoint, coordinates[i]);
        if(distance < minDistance) {
            closestCoordinateId = i;
            minDistance = distance;
        }
      }
      var closestGeometryCoordinate = coordinates[closestCoordinateId];
      var picsData = closestFeature.get("openstreetview")['pics'];
      var picData = picsData[closestCoordinateId];
      // Ask the OpenStreetView instance to display this picture
      this.osvp.showPicture(picData.id);
      


      if(this.debug) {
        if (this.debugClosestGeometryPoint === null) {
          this.debugClosestGeometryPoint = new ol.geom.Point(closestGeometryPoint);
        } else {
          this.debugClosestGeometryPoint.setCoordinates(closestGeometryPoint);
        }
        var coordinates = [coordinate, [closestGeometryPoint[0], closestGeometryPoint[1]]];
        if (this.debugClosestGeometryLine === null) {
          this.debugClosestGeometryLine = new ol.geom.LineString(coordinates);
        } else {
          this.debugClosestGeometryLine.setCoordinates(coordinates);
        }

        var debugLineCoordinates = [closestGeometryPoint, closestGeometryCoordinate];
        if (this.debugClosestPointLine === null) {
          this.debugClosestPointLine = new ol.geom.LineString(debugLineCoordinates);
        } else {
          this.debugClosestPointLine.setCoordinates(debugLineCoordinates);
        }
      }
    }

    this.map.render();
  },

  // Basic distance between points, incorrect in long lengths (projection etc)
  distanceBetweenPoints: function(latlng1, latlng2) {
      var line = new ol.geom.LineString([latlng1, latlng2]);
      return Math.round(line.getLength() * 100) / 100;
  },

  // Merge objects together - from Secrets fo the JavaScript Ninja
  merge: function(root) {
    for (var i = 1; i < arguments.length; i++) {
      for (var key in arguments[i]) {
        root[key] = arguments[i][key];
      }
    }
    return root;
  }
}






/**
 * The viewer of the OSV pics
 */
function OpenStreetViewPane(params) {
  this.debug = true;

  // Pics data
  this.picsData = {};
  this.currentPicId = null;
  this.picsTexture = {};

  // Three.js elements
  this.domElement = null;
  this.threeRenderer = null;
  this.threeCamera = null;
  this.threeGeometry = null;
  this.threeMaterial = null;
  this.threeSphere = null;
  this.arrowMesh = null;
  this.threeArrows = [];
  this.threeScene = null;
  this.threeRaycaster = null;
  this.threeJsonLoader = null;

  // Camera
  this.lon = 0, this.onMouseDownLon = 0,
  this.lat = 0, this.onMouseDownLat = 0,
  this.phi = 0, this.theta = 0;
  this.isUserInteracting = false;
  this.initTime = null;

  var defaults = {
    // The DOM element receiving the viewer
    target: 'openstreetview',
    // The viewer dimension
    width: 640,
    height: 480,
    hint360: false
  };

  // Merge default with params
  this.params = this.merge(defaults, params);

  // Init the viewer
  this.initViewer();
  this.renderingLoop();
}


OpenStreetViewPane.prototype = {
  constructor: OpenStreetViewPane,

  /**
   * Add a picture into our library
   */
  addPicture: function(picData) {
    this.picsData[picData.id] = picData;

    if(picData.id == this.currentPicId) {
      this.showPictureArrows();
    }
  },

  /**
   * Get all the pictures data
   */
  getPictures: function() {
    return this.picsData;
  },

  /**
   * Get the id of the picture currently being shown
   */
  getDisplayedPictureId: function() {
    return this.currentPicId;
  },

  /**
   * Show a specific picture
   */
  showPicture: function(id) {
    var pic = this.picsData[id];

    if(pic == undefined) {
      return;
    }

    if(this.currentPicId == id) {
      return;
    }

    var oldPicId = this.currentPicId;
    this.currentPicId = id;

    var threeMaterial = new THREE.MeshBasicMaterial( {
        map: this.getPictureTexture(id)
    });
    threeSphere.material.dispose();
    threeSphere.material = threeMaterial;

    // Picture angle correction
    threeSphere.rotation.x = pic.correction.rotation.x * Math.PI / 180;
    threeSphere.rotation.y = pic.correction.rotation.y * Math.PI / 180;
    threeSphere.rotation.z = pic.correction.rotation.z * Math.PI / 180;

    this.showPictureArrows();

    var event = new Event('navigate');
    event.oldPicId = oldPicId;
    event.newPicId = id;
    this.domElement.dispatchEvent(event);
  },


  /**
   * PRIVATE
   */

  /**
   * Init the viewer with Three.js
   */
  initViewer: function() {
    this.domElement = document.getElementById(this.params.target);
    this.domElement.className = this.domElement.className + " openstreetview";

    this.threeCamera = new THREE.PerspectiveCamera( 75, this.params.width / this.params.height, 0.1, 1100);
    this.threeCamera.target = new THREE.Vector3( 0, 0, 0 );

    this.threeScene = new THREE.Scene();

    var threeGeometry = new THREE.SphereGeometry( 500, 60, 40 );
    threeGeometry.scale( - 1, 1, 1 );

    var threeMaterial = new THREE.MeshBasicMaterial();
    threeSphere = new THREE.Mesh( threeGeometry, threeMaterial );
    
    this.threeScene.add( threeSphere );

    this.threeRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.threeRenderer.setPixelRatio(window.devicePixelRatio);
    this.threeRenderer.setSize(this.params.width, this.params.height);
    this.domElement.appendChild(this.threeRenderer.domElement);    

    // initialize raycaster
    this.threeRaycaster = new THREE.Raycaster()

    // Initialize JSON model loader
    this.threeJsonLoader = new THREE.JSONLoader();

    // load the arrow model
    var self = this;
    this.threeJsonLoader.load(
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
        
        self.showPictureArrows();
      }
    );

    // Setup the controls
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    window.addEventListener('mouseup', this.onMouseUp.bind(this), false );
    this.domElement.addEventListener('mousewheel', this.onMouseWheel.bind(this), false);
    this.domElement.addEventListener('MozMousePixelScroll', this.onMouseWheel.bind(this), false);

    this.initTime = new Date();
  },


  /**
   * The rendering loop
   */
  renderingLoop: function() {
      requestAnimationFrame(this.renderingLoop.bind(this));
      this.render();
  },

  /**
   * The main rendering function
   */
  render: function() {
    // A 360 hint, to show that you can drag the picture around
    if(this.params.hint360) {
      var timediff = new Date() - this.initTime;
      if(timediff < 4000) {
        this.lon += 0.2 * (4000 - timediff) / 4000;
      }
    }

    this.lat = Math.max(-85, Math.min(85, this.lat));
    this.phi = THREE.Math.degToRad(90 - this.lat);
    this.theta = THREE.Math.degToRad(this.lon);

    this.threeCamera.target.x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
    this.threeCamera.target.y = 500 * Math.cos(this.phi);
    this.threeCamera.target.z = 500 * Math.sin(this.phi) * Math.sin(this.theta);

    this.threeCamera.lookAt(this.threeCamera.target);

    /*
    // distortion
    camera.position.copy( camera.target ).negate();
    */

    this.threeRenderer.render(this.threeScene, this.threeCamera);
  },

  /**
   * Show the navigation arrows
   */
  showPictureArrows: function() {
    var pic = this.picsData[this.currentPicId];

    if(pic == undefined) {
      return;
    }

    // Removing current arrows
    while(arrow = this.threeArrows.pop()) {
      this.threeScene.remove(arrow);
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

        this.threeScene.add(arrowModel);
        this.threeArrows.push(arrowModel);
      }
    }
  },

  /**
   * Fetch or reuse a pic
   */
  getPictureTexture: function(picId) {
    var pic = this.picsData[picId];

    if(pic == undefined) {
      return null;
    }

    if(this.picsTexture[picId]) {
      return this.picsTexture[picId];
    }

    this.picsTexture[picId] = THREE.ImageUtils.loadTexture(pic.url);
    return this.picsTexture[picId];
  },

  /**
   * Event listener
   */
  on: function(type, listener, opt_this) {
    if(opt_this) {
      listener = listener.bind(opt_this);
    }
    this.domElement.addEventListener(type, listener);
  },


  onMouseDown: function(event) {
    event.preventDefault();
    this.isUserInteracting = true;

    //
    // Prepare for camera moving with mouse DnD
    //
    onPointerDownPointerX = event.clientX;
    onPointerDownPointerY = event.clientY;
    onPointerDownLon = this.lon;
    onPointerDownLat = this.lat;


    //
    // Find out if we got a directional arrow clicked
    //
    // Local 2D x/y cursor position
    var rect = this.domElement.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;

    // Convert into a 3D cursor, x:(-1,1), y:(-1,1)
    var mouse = new THREE.Vector3(
      (x / this.params.width) * 2 - 1,
      -(y / this.params.height) * 2 + 1,
      0.5
    );  

    // Raycast and get the intersected arrows
    this.threeRaycaster.setFromCamera(mouse, this.threeCamera);
    var intersects = this.threeRaycaster.intersectObjects(this.threeArrows, true);
    
    // if an arrow is clicked, we navigate
    if(intersects.length > 0)
    {
      this.showPicture(intersects[0].object.parent.userData.picId);
      // change the color of the closest face.
      // intersects[ 0 ].face.color.setRGB( 0.8 * Math.random() + 0.2, 0, 0 ); 
      // intersects[ 0 ].object.geometry.colorsNeedUpdate = true;
    }
  },

  onMouseMove: function(event) {
    if(this.isUserInteracting === true) {
      this.lon = (onPointerDownPointerX - event.clientX) * 0.1 + onPointerDownLon;
      this.lat = (event.clientY - onPointerDownPointerY) * 0.1 + onPointerDownLat;
    }
  },

  onMouseUp: function(event) {
    this.isUserInteracting = false;
  },

  onMouseWheel: function(event) {
    var fovMax = 80;
    var fovMin = 20;

    var newFov = 0;
    // WebKit
    if (event.wheelDeltaY) {
        newFov = this.threeCamera.fov - event.wheelDeltaY * 0.05;
    }
    // Opera / Explorer 9
    else if (event.wheelDelta) {
        newFov = this.threeCamera.fov - event.wheelDelta * 0.05;
    }
    // Firefox
    else if (event.detail) {
        newFov = this.threeCamera.fov + event.detail * 0.05;
    }

    if(fovMin < newFov && newFov < fovMax) {
      this.threeCamera.fov = newFov;
      this.threeCamera.updateProjectionMatrix();
    }

    event.preventDefault();
  },

  // Prints a log message if in debug mode and console is available
  log: function(message) {
    if (window.console && this.debug) {
      console.log(message);
    }
  },

  // Merge objects together - from Secrets fo the JavaScript Ninja
  merge: function(root) {
    for (var i = 1; i < arguments.length; i++) {
      for (var key in arguments[i]) {
        root[key] = arguments[i][key];
      }
    }
    return root;
  }
}