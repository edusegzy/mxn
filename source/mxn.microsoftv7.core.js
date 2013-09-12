mxn.register('microsoftv7', {

Mapstraction: {
	init: function(element, api, properties) {
		var me = this;

		if (typeof Microsoft.Maps === 'undefined') {
			throw new Error(api + ' map script not imported');
		}

		var options = {
			credentials: microsoftv7_key,
			enableClickableLogo: false,
			enableSearchLogo: false,
			showDashboard: false,
			showMapTypeSelector: false,
			showScalebar: false
		};
		var disable = {
			double_click: false,
			scroll_wheel: false
		};
		
		if (typeof properties !== 'undefined' && properties !== null) {
			if (properties.hasOwnProperty('controls')) {
				var controls = properties.controls;
				var show_dashboard = false;
				
				if ('pan' in controls && controls.pan) {
					options.showDashboard = true;
				}
				
				if ('zoom' in controls && controls.zoom || controls.zoom === 'small' || controls.zoom === 'large') {
					options.showDashboard = true;
				}
				
				// The overview/mini-map control isn't supported in the Bing v7 API. No, really.
				// See below for a rant.
				// TODO: Investigate possibility of implementing a custom overview map, see
				// http://pietschsoft.com/post/2010/12/19/Bing-Maps-Ajax-7-Add-a-Simple-Mini-Map
				// http://bingmapsv7modules.codeplex.com/wikipage?title=Mini-Map%20Module
				
				/*if ('overview' in controls) {
					
				}*/
				
				if ('scale' in controls && controls.scale) {
					options.showScalebar = true;
					options.showDashboard = true;
				}
				
				if ('map_type' in controls && controls.map_type) {
					options.showMapTypeSelector = true;
					options.showDashboard = true;
				}
			}
			
			if (properties.hasOwnProperty('center') && null !== properties.center) {
				var point;
				if (Object.prototype.toString.call(properties.center) === '[object Array]') {
					point = new mxn.LatLonPoint(properties.center[0], properties.center[1]);
				}
				
				else {
					point = properties.center;
				}
				options.center = point.toProprietary(this.api);
			}
			
			if (properties.hasOwnProperty('zoom') && null !== properties.zoom) {
				options.zoom = properties.zoom;
			}
			
			if (properties.hasOwnProperty('map_type') && null !== properties.map_type) {
				switch (properties.map_type) {
					case mxn.Mapstraction.ROAD:
						options.mapTypeId = Microsoft.Maps.MapTypeId.road;
						break;
					case mxn.Mapstraction.PHYSICAL:
						options.mapTypeId = Microsoft.Maps.MapTypeId.road;
						break;
					case mxn.Mapstraction.HYBRID:
						options.mapTypeId = Microsoft.Maps.MapTypeId.birdseye;
						break;
					case mxn.Mapstraction.SATELLITE:
						options.mapTypeId = Microsoft.Maps.MapTypeId.aerial;
						options.labelOverlay = Microsoft.Maps.LabelOverlay.hidden;
						break;
					default:
						options.mapTypeId = Microsoft.Maps.MapTypeId.road;
						break;
				}
			}
			
			if (properties.hasOwnProperty('dragging')) {
				options.disableUserInput = true;
			}

			if (properties.hasOwnProperty('scroll_wheel')) {
				disable.scroll_wheel = true;
			}

			if (properties.hasOwnProperty('double_click')) {
				disable.double_click = true;
			}
		}
		// The design decisions behind the Microsoft/Bing v7 API are simply jaw dropping.
		// Want to show/hide the dashboard or show/hide the scale bar? Nope. You can only
		// do that when you're creating the map object. Once you've done that the map controls
		// stay "as-is" unless you want to tear down the map and redisplay it. And as for the
		// overview "mini-map", that's not supported at all and you have to write your own.
		// See http://msdn.microsoft.com/en-us/library/gg427603.aspx for the whole sorry tale.
		
		// Code Health Warning
		// The documentation for the Microsoft.Maps.Map constructor says you can either
		// pass a MapOptions *or* a ViewOptions object as the 2nd constructor argument.
		// (http://msdn.microsoft.com/en-us/library/gg427609.aspx)
		// Despite this; it appears that if you aggregate the properties of MapOptions and
		// ViewOptions into a single object and pass this, it all automagically works.

		this.maps[api] = new Microsoft.Maps.Map(element, options); 

		//Now get the update the microsoft key to be session key for geocoding use later without racking up api hits
		this.maps[api].getCredentials(function(credentials) 
			{ 
				if(credentials !== null) { microsoft_key = credentials; } 
			});
			
		// Disable scroll wheel/mouse wheel interaction if specified in the
		// constructor properties

		Microsoft.Maps.Events.addHandler(this.maps[api], 'mousewheel', function(event) {
			if (event.targetType == 'map') {
				event.handled = true;
			}
		});
		
		// Disable double-click to zoom if specified in the constructor
		// properties

		Microsoft.Maps.Events.addHandler(this.maps[api], 'dblclick', function(event) {
			event.handled = true;
		});

		//Add Click Event - with IE7 workaround if needed
		if (element.addEventListener) {
			element.addEventListener('contextmenu', function(event) {
				event.preventDefault();
			});
		}
		
		else if (element.attachEvent) {
			element.attachEvent('contextmenu', function(event) {
				evt.preventDefault();
			});
		}

		Microsoft.Maps.Events.addHandler(this.maps[api], 'click', function(event){
			var map = me.maps[me.api];
			if (event.originalEvent.preventDefault) {
		        event.originalEvent.preventDefault();
		    }

			if (event.targetType == 'pushpin') {
				event.target.mapstraction_marker.click.fire();
			}

			else {
				var _x = event.getX();
				var _y = event.getY();
				var pixel = new Microsoft.Maps.Point(_x, _y);
				var ll = map.tryPixelToLocation(pixel);
				var _event = {
					'location': new mxn.LatLonPoint(ll.latitude, ll.longitude),
					'position': {x:_x, y:_y},
					'button': event.isSecondary ? 'right' : 'left'
				};
				me.click.fire(_event);
			}
		});

		Microsoft.Maps.Events.addHandler(this.maps[api], 'viewchangeend', me.changeZoom.fire);
		Microsoft.Maps.Events.addHandler(this.maps[api], 'viewchangeend', me.endPan.fire);    
	
		var loadListener = Microsoft.Maps.Events.addHandler(this.maps[api], 'tiledownloadcomplete', function(event) {
			me.load.fire();
			Microsoft.Maps.Events.removeHandler(loadListener);
		});
	},
	
	getVersion: function() {
		return Microsoft.Maps.Map.getVersion();
	},
	
	applyOptions: function(){
		var map = this.maps[this.api];
		var opts = map.getOptions();

		opts.disablePanning = !this.options.enableDragging;
		opts.disableZooming = !this.options.enableScrollWheelZoom;

		map.setOptions(opts);
	},

	resizeTo: function(width, height){	
		var map = this.maps[this.api];
		map.setOptions(height,width);
	},

	// Code Health Warning
	// Microsoft7 only supports (most of) the display controls as part of the Dashboard
	// and this needs to be configured *before* the map is instantiated and displayed.
	// So addControls, addSmallControls, addLargeControls and addMapTypeControls are
	// effectively no-ops and so they don't throw the unsupported feature exception.
	
	addControls: function( args ) {
		var map = this.maps[this.api];
	
		//throw new Error('Mapstraction.addControls is not currently supported by provider ' + this.api);
	},

	addSmallControls: function() {
		var map = this.maps[this.api];
		
		//throw new Error('Mapstraction.addSmallControls is not currently supported by provider ' + this.api);
	},

	addLargeControls: function() {
		var map = this.maps[this.api];
		
		//throw new Error('Mapstraction.addLargeControls is not currently supported by provider ' + this.api);
	},

	addMapTypeControls: function() {
		var map = this.maps[this.api];
		
		//throw new Error('Mapstraction.addMapTypeControls is not currently supported by provider ' + this.api);
	},

	setCenterAndZoom: function(point, zoom) { 
		var map = this.maps[this.api];
		var pt = point.toProprietary(this.api);	

		// Get the existing options.
		var options = {};
		options.zoom = zoom;
		options.center = pt;
		
		map.setView(options);
	},
	
	addMarker: function(marker, old) {
		var map = this.maps[this.api];
		var pin = marker.toProprietary(this.api);
		
		map.entities.push(pin);
		
		
		return pin;
	},

	removeMarker: function(marker) {
		var map = this.maps[this.api];
		if (marker.proprietary_marker) {
			map.entities.remove(marker.proprietary_marker);
		}
	},
	
	declutterMarkers: function(opts) {
		var map = this.maps[this.api];
		
		throw new Error('Mapstraction.declutterMarkers is not currently supported by provider ' + this.api);
	},

	addPolyline: function(polyline, old) {
		var map = this.maps[this.api];
		var pl = polyline.toProprietary(this.api);
		
		map.entities.push(pl);
				
		return pl;
	},

	removePolyline: function(polyline) {
		var map = this.maps[this.api];
		
		if (polyline.proprietary_polyline) {
			map.entities.remove(polyline.proprietary_polyline);
		}
	},
	
	getCenter: function() {
		var map = this.maps[this.api];
		var center = map.getCenter();
		
		return new mxn.LatLonPoint(center.latitude, center.longitude);
	},

	setCenter: function(point, options) {
		var map = this.maps[this.api];
		var pt = point.toProprietary(this.api);
	 
		// Get the existing options.
		var msOptions = map.getOptions();
		msOptions.center = pt;
		msOptions.bounds = null;
		map.setView(msOptions);
	},

	setZoom: function(zoom) {
		var map = this.maps[this.api];
		// Get the existing options.
		var options = map.getOptions();
		options.zoom = zoom;
		map.setView(options);
	},
	
	getZoom: function() {
		var map = this.maps[this.api];
		
		return map.getZoom();
	},

	getZoomLevelForBoundingBox: function( bbox ) {
		var map = this.maps[this.api];
		// NE and SW points from the bounding box.
		var ne = bbox.getNorthEast();
		var sw = bbox.getSouthWest();
		var zoom;
		
		throw new Error('Mapstraction.getZoomLevelForBoundingBox is not currently supported by provider ' + this.api);
	},

	setMapType: function(type) {
		var map = this.maps[this.api];
		var options = map.getOptions();
		
		switch (type) {
			case mxn.Mapstraction.ROAD:
				options.mapTypeId = Microsoft.Maps.MapTypeId.road;
				break;
			case mxn.Mapstraction.SATELLITE:
				options.mapTypeId = Microsoft.Maps.MapTypeId.aerial;
				options.labelOverlay = Microsoft.Maps.LabelOverlay.hidden;
				break;
			case mxn.Mapstraction.HYBRID:
				options.mapTypeId = Microsoft.Maps.MapTypeId.birdseye;
				break;
			default:
				options.mapTypeId = Microsoft.Maps.MapTypeId.road;
		}

		map.setView(options);	 
	},

	getMapType: function() {
		var map = this.maps[this.api];
		var options = map.getOptions();
		switch (options.mapTypeId) {
			case Microsoft.Maps.MapTypeId.road:
				return mxn.Mapstraction.ROAD;
			case Microsoft.Maps.MapTypeId.aerial:
				return mxn.Mapstraction.SATELLITE;
			case Microsoft.Maps.MapTypeId.birdseye:
				return mxn.Mapstraction.HYBRID;
			default:
				return mxn.Mapstraction.ROAD;
		}

	},

	getBounds: function () {
		var map = this.maps[this.api];
		var bounds = map.getBounds();
		var nw = bounds.getNorthwest();
		var se = bounds.getSoutheast();
		
		return new mxn.BoundingBox(se.latitude, nw.longitude, nw.latitude, se.longitude);
	},

	setBounds: function(bounds){
		var map = this.maps[this.api];
		var nw = bounds.getNorthWest();
		var se = bounds.getSouthEast();
		var viewRect = Microsoft.Maps.LocationRect.fromCorners(new Microsoft.Maps.Location(nw.lat, nw.lon), new Microsoft.Maps.Location(se.lat ,se.lon));
		var options = map.getOptions();
		options.bounds = viewRect;
		options.center = null;
		map.setView(options);
	},

	addImageOverlay: function(id, src, opacity, west, south, east, north, oContext) {
		throw new Error('Mapstraction.addImageOverlay is not currently supported by provider ' + this.api);
	},

	setImagePosition: function(id, oContext) {
		throw new Error('Mapstraction.setImagePosition is not currently supported by provider ' + this.api);
	},
	
	addOverlay: function(url, autoCenterAndZoom) {
		throw new Error('Mapstraction.addOverlay is not currently supported by provider ' + this.api);
	},

	addTileLayer: function(tile_url, opacity, label, attribution, min_zoom, max_zoom, map_type, subdomains) {
		var map = this.maps[this.api];
		var z_index = this.tileLayers.length || 0;

		 var newtileobj = {
			getTileUrl: function(tile){
				if (typeof subdomains !== 'undefined') {
					tile_url = mxn.util.getSubdomainTileURL(tile_url, subdomains);
				}
			
				return tile_url.replace(/\{Z\}/gi, tile.levelOfDetail).replace(/\{X\}/gi, tile.x).replace(/\{Y\}/gi, tile.y);
			}
		 };

        var tileSource = new Microsoft.Maps.TileSource({ uriConstructor: newtileobj.getTileUrl});

        var tileLayerOptions = {};
        tileLayerOptions.mercator = tileSource;
		tileLayerOptions.opacity = opacity;

        // Construct the layer using the tile source
        var tilelayer = new Microsoft.Maps.TileLayer(tileLayerOptions);

        // Push the tile layer to the map
        map.entities.push(tilelayer);
		
		this.tileLayers.push( [tile_url, tilelayer, true, z_index] );
		return tilelayer;
	},

	toggleTileLayer: function(tile_url) {
		var map = this.maps[this.api];
		for (var f = 0; f < this.tileLayers.length; f++) {
			var tileLayer = this.tileLayers[f];
			if (tileLayer[0] == tile_url) {
				if (tileLayer[2]) {
					tileLayer[2] = false;
				}
				else {
					tileLayer[2] = true;
				}
				tileLayer[1].setOptions({ visible: tileLayer[2]});
			}
		}
	},

	getPixelRatio: function() {
		throw new Error('Mapstraction.getPixelRatio is not currently supported by provider ' + this.api);
	},
	
	mousePosition: function(element) {
		var map = this.maps[this.api];
		var locDisp = document.getElementById(element);
		if (locDisp !== null) {
			Microsoft.Maps.Events.addHandler(map, 'mousemove', function (e) {
				if (typeof (e.target.tryPixelToLocation) != 'undefined') {
					var point = new Microsoft.Maps.Point(e.getX(), e.getY());
					var coords = e.target.tryPixelToLocation(point);
					var loc = coords.latitude.toFixed(4) + '/' + coords.longitude.toFixed(4);
					locDisp.innerHTML = loc;
				}
			});
			locDisp.innerHTML = '0.0000 / 0.0000';
		}
	}
},

LatLonPoint: {
	
	toProprietary: function() {
		return new Microsoft.Maps.Location(this.lat, this.lon);
	},

	fromProprietary: function(mPoint) {
		this.lat = mPoint.latitude;
		this.lon = mPoint.longitude;
	}
	
},

Marker: {
	
	toProprietary: function() {
		var options = {};
		if (this.draggable)
		{
			options.draggable = true;
		}
		var ax = 0;	// anchor x 
		var ay = 0;	// anchor y

		if (this.iconAnchor) {
			ax = this.iconAnchor[0];
			ay = this.iconAnchor[1];
		}
		var mAnchorPoint = new Microsoft.Maps.Point(ax,ay);
		if (this.iconUrl) {
			options.icon = this.iconUrl;
			options.height = this.iconSize[1];
			options.width = this.iconSize[0];
			options.anchor = mAnchorPoint;
		}
		if (this.label)
		{
			options.text = this.label;
		}
		if (this.htmlContent) {
            options.htmlContent = this.htmlContent;
			options.anchor = mAnchorPoint;
        }
		
		var mmarker = new Microsoft.Maps.Pushpin(this.location.toProprietary(this.api), options);  

		var that = this;
		Microsoft.Maps.Events.addHandler(mmarker, 'mouseover', function(){
			if (that.hover && that.infoBubble) 
				{
					that.openBubble();

					if (!that.infowindow_mouseleave){
						that.infowindow_mouseleave = Microsoft.Maps.Events.addHandler(that.proprietary_infowindow, 'mouseleave', function(){
							if (that.infoBubble && that.proprietary_infowindow) 
								{
									that.closeBubble();
									if (that.infowindow_mouseleave) {
										Microsoft.Maps.Events.removeHandler(that.infowindow_mouseleave);
										that.infowindow_mouseleave = null;
										}
								}
							}); 
						}
				}
		});
		
		return mmarker;
	},

	openBubble: function() {
		var infowindow = new Microsoft.Maps.Infobox(this.location.toProprietary(this.api),
			{
				description: this.infoBubble
			});
		
		this.openInfoBubble.fire({'marker': this});
		this.map.entities.push(infowindow);
		infowindow.setOptions({visible: true});
		this.proprietary_infowindow = infowindow; // Save so we can close it later
	},
	closeBubble: function() {
		if (!this.map) {
			throw new Error('Marker.closeBubble; marker must be added to map in order to display infobox');
		}
		if (!this.proprietary_infowindow) {
			return;
		}
		this.proprietary_infowindow.setOptions({visible:false});
		this.map.entities.remove(this.proprietary_infowindow);
		this.closeInfoBubble.fire( { 'marker': this } );
	},
	hide: function() {
		this.proprietary_marker.setOptions({visible: false});
	},

	show: function() {
		this.proprietary_marker.setOptions({visible: true});
	},

	update: function() {
		var loc = this.proprietary_marker.getLocation();
		var point = new mxn.LatLonPoint(loc.latitude, loc.longitude);
		this.location = point;
	}
	
},

Polyline: {

	toProprietary: function() {
		var coords = [];

		for (var i = 0, length = this.points.length; i < length; i++) {
			coords.push(this.points[i].toProprietary(this.api));
		}
		
		if (this.closed) {
			if (!(this.points[0].equals(this.points[this.points.length - 1]))) {
				coords.push(coords[0]);
			}
		}

		else if (this.points[0].equals(this.points[this.points.length - 1])) {
			this.closed = true;
		}

		var strokeColor = Microsoft.Maps.Color.fromHex(this.color);
		if (this.opacity) {
			strokeColor.a = this.opacity * 255;
		}
		var fillColor = Microsoft.Maps.Color.fromHex(this.fillColor);
		if (this.opacity) {
			fillColor.a = this.opacity * 255;
		}
		
		var polyOptions = {
			strokeColor: strokeColor,
			strokeThickness: this.width
		};

		if (this.closed) {
			polyOptions.fillColor = fillColor;
			this.proprietary_polyline = new Microsoft.Maps.Polygon(coords, polyOptions);
		}
		else {
			this.proprietary_polyline = new Microsoft.Maps.Polyline(coords, polyOptions);
		}

		return this.proprietary_polyline;
	},
	
	show: function() {
		this.proprietary_polyline.setOptions({visible:true});
	},

	hide: function() {
		this.proprietary_polyline.setOptions({visible:false});
	}	
}

});