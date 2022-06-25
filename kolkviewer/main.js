/*
 * This file is part of the Kolkturm Viewer 360
 *
 * Copyright (c) 2022 Alexander Graeb
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * (see LICENSE_LGPLv3) along with this program.  If not, see
 * <http://www.gnu.org/licenses/>.
 *
 */
var canvas = null;
var ctx2d = null;
var wrapper = null;
var pano = null; // The DOM object representing the panorama picture
var vw = null; // View (canvas) width
var vh = null; //   and height
var vr = null; // View ratio
var iw = null; // Image width
var ih = null; //   and height
var posx = 0; // X and
var posy = 0; //   y position of the clipping area
var posz = 1.0; // Z position (zoom factor)
var minz = null; // Minimum z position
var nx_pos = null; // The position at the x axis where north is located
var mousex = null;
var mousey = null;
var mouseclicked = false;

/**
 * Indicates that an animation is in progress. Running animations MUST
 * stop if that variable is set to false. Also animations MUST set this
 * variable to false after they complete.
 */
var animation_running = false;

// Public variables required for the compass
var compass_path2d = [];
var px_letter_circle = [];
var py_letter_circle = [];

var objects = [];
var last_hovered_object = null;
var objinfo_div = null;
var draw_all_object_areas = false;
var draw_object_areas_on_mouseover = false;

/**
 * Init function for the Kolkturm Viewer 360 called once the page has loaded
 * @param {string} canvas_id - ID of the <canvas /> element (main drawing area)
 * @param {string} data_url - URL pointing to the json file which is the central information base
 */
function initKolkViewer(canvas_id, data_url) {
    var json_request = new XMLHttpRequest();

    canvas = $("#" + canvas_id).get(0);
    ctx2d = canvas.getContext('2d');
    wrapper = $(canvas).parent();
    objinfo_div = $("<div>", { class: "ktv-objinfo" }).appendTo(wrapper);

    vw = $(wrapper).width();
    vh = $(wrapper).height();
    vr = vw/vh;

    pano = new Image();

    pano.onload = function() {
        iw = pano.width;
        ih = pano.height;
        minz = vh / ih;
        movex(-(vw/2*ih*posz/vh-nx_pos)); // That takes the north direction into the view center
        animation_running = false; // Stop loading animation
        draw();
    }

    // All required information is stored in a json file,
    // even the panorama picture source URL
    json_request.open('GET', data_url);
    json_request.responseType = 'json';
    json_request.send();

    json_request.onload = function() {
        nx_pos = json_request.response['north_xposition']
        pano.src = json_request.response['pano_url'];
        objects = prepareObjectArray(json_request.response['objects']);
    }

    canvas.width = vw;
    canvas.height = vh;

    prepareCompass();

    animation_running = true;
    loadingAnimation();

    // Setting up handlers
    $(document).keydown(keyHandler);
    $(canvas).mousewheel(mouseWheelHandler);
    $(canvas).mousedown(mouseDownHandler);
    $(document).mouseup(mouseUpHandler); // Mouse up event must be bound to the document
    $(document).mousemove(mouseMoveHandler); // See comment above
}

/**
 * Event handler for mouse move events called by the browser
 * @param {object} event - Object with information about the mouse move event
 */
function mouseMoveHandler(event) {
    if (mouseclicked) {
        if (mousex != null && mousey != null) {
            var deltax = (mousex - event.pageX)*(ih*posz/vh);
            var deltay = (mousey - event.pageY)*(ih*posz/vh);
            movex(deltax);
            movey(deltay);
            draw();
        }

        mousex = event.pageX;
        mousey = event.pageY;
        animation_running = false;
    } else {
        mouseHoverObjectHandler(event.pageX, event.pageY)
    }
}

/**
 * Event handler for mouse button down events called by the browser
 * @param {object} event - Object with information about the mouse button event
 */
function mouseDownHandler(event) { // Left mouse button
    mouseclicked = (event.which == 1);
}

/**
 * Event handler for mouse button up events called by the browser
 * @param {object} event - Object with information about the mouse button event
 */
function mouseUpHandler(event) {
    if (event.which == 1) { // Left mouse button
        mouseclicked = false;
        mousex = mousey = null;
    }
}

/**
 * Event handler for mouse wheel events called by the browser
 * @param {object} event - Object with information about the mouse wheel event
 */
function mouseWheelHandler(event) {
    zoom(event.deltaY*event.deltaFactor/-10000, event.pageX/vw, event.pageY/vh);
    draw();
}

/**
 * Event handler for keyboard key down events called by the browser
 * @param {object} event - Object with information about the key
 */
function keyHandler(event) {
    console.log("event.which: " + event.which + " event.keyCode: " + event.keyCode);
    switch (event.which) {
        case 27: // Escape
            animation_running = false; // Cancel all running animations
            break;
        case 37: // Left
            movex(-10);
            draw();
            break;
        case 39: // Right
            movex(10);
            draw();
            break;
        case 38: // Up
            movey(-10);
            draw();
            break;
        case 40: // Down
            movey(+10);
            draw();
            break;
        case 48: // Zero
        case 96:
            resetZoom();
            draw();
            break;
        case 107: // Plus
        case 171:
            zoom(-0.01, 0.5, 0,5);
            draw();
            break;
        case 109: // Minus
        case 173:
            zoom(0.01, 0.5, 0.5);
            draw();
            break;
        case 78: // N - North position
            moveToCompassPosition('N');
            break;
        case 69: // E - East position
        case 79: // O - Ost (east in German) position
            moveToCompassPosition('O');
            break;
        case 83: // S - South position
            moveToCompassPosition('S');
            break;
        case 87: // W - West position
            moveToCompassPosition('W');
            break;
    }
}

/**
 * Changes the zoom factor relatively
 * @param {number} zi - z increment (positive number = zoom out;  negative number = zoom in)
 * @param {number} fx - Fix point at the x axis while zooming (valid values between 0 and 1)
 * @param {number} fy - Fix point at the y axis while zooming (valid values between 0 and 1)
 */
function zoom(zi, fx, fy) {
    var oldz = posz;

    posz = Math.min(Math.max(posz + zi, minz), 1);

    // Keep center centered while zooming
    movex((oldz*vr*ih - posz*vr*ih)*fx);
    movey((oldz*ih - posz*ih)*fy);
}

/**
 * Resets the zoom factor to the initial value
 */
function resetZoom() {
    var oldz = posz;

    posy = 0;
    posz = 1.0;

    movex((oldz*vr*ih - vr*ih)/2); // Keep center centered while reset zoom factor
}

/**
 * Relatively moves the clipping area on the y (horizontal) axis
 * @param {number} yi - y increment (positive number = move down;  negative number = move up)
 */
function movey(yi) {
    posy = Math.min(Math.max(posy + yi, 0), ih - posz*ih);
}

/**
 * Relatively moves the clipping area on the x (vertical) axis
 * @param {number} xi - x increment (positive number = to the right;  negative number = to the left)
 */
function movex(xi) {
    posx += xi;
    var maxx = iw - vr*ih*posz;

    // For x (vertical) axis support infinit scrolling.
    if (posx > maxx) {
        posx = -vr*ih*posz + (posx - maxx);
    } else if (posx < -(vr*ih*posz)) {
        posx = maxx + (posx + vr*ih*posz);
    }
}

/**
 * Moves the center view position to the given compass direction
 * @param {character} cpos - A character out of [nNeEoOsSwW], e.g. 'n' for north
 */
function moveToCompassPosition(cpos) {
    const north_pos = nx_pos-vw/2*ih*posz/vh;
    var tpos = 0; // Target position
    var movdir = 1;

    switch (cpos) {
        case 'n', 'N':
            tpos = north_pos;
            break;
        case 'e', 'E', 'o', 'O':
            tpos = north_pos + iw/4;
            break;
        case 's', 'S':
            tpos = north_pos + iw/4*2;
            break;
        case 'w', 'W':
            tpos = north_pos + iw/4*3;
            break;
        default:
            return;
    }

    if (tpos > posx) { // Target position is to the right from current position
        dist = tpos - posx;

        // Distance is shorter if moving the the left
        if (dist > (posx + iw - tpos)) {
            dist = posx + iw - tpos;
            movdir = -1;
        }
    } else {
        dist = posx - tpos;
        movdir = -1;

        // Distance is shorter if moving to the right
        if (dist > (tpos + iw - posx)) {
            dist = tpos + iw - posx;
            movdir = 1;
        }
    }

    animation_running = true;
    animatedMoveToXPos(dist, movdir);
}

/**
 * Performs an animated move on the x axis over a given distance and moving
 * direction. The speed of the movement increases first and when decreases
 * until the movement for the given distance is finally complete. Before
 * that function is called the global variable animation_running MUST be set
 * to true.
 * @param {number} number - Distance to be covered, must be positive
 * @param {number} movdir - Moving direction. Either to the right (movdir == 1, e.g. from north to east)
 *                          or to the left (movdir == -1, e.g. from north to west)
 * @param {number} cov - Covered distance so far. NOT meant to be set by the user
 * @param {number} speed - Current speed of movement. NOT meant to be set by the user
 * @param {number} acc - Indicates whether the speed is increasing (1) or decreasing (-1). NOT meant to be set by the user
 */
function animatedMoveToXPos(dist, movdir=0, cov=0, speed=0, acc=1) {
    if (!(movdir == 1 || movdir == -1)) {
        throw new Error("Parameter movdir must be either 1 or -1");
    }

    if (!(acc == 1 || acc == -1)) {
        throw new Error("Parameter acc must be either 1 or -1");
    }

    speed += acc * 20;

    if (cov >= dist/2) acc = -1;

    if ((cov + speed) > dist) speed = dist - cov;

    cov += speed;
    movex(movdir * speed);

    if (cov < dist && animation_running) {
        setTimeout(animatedMoveToXPos, 50, dist, movdir, cov, speed, acc);
    } else {
        animation_running = false;
    }

    draw();
}

/**
 * The information about objects is beeing fetched from json data. This function supplements data
 * which is optional or can be calculated from given data.
 * @param {object} json_data - Json object which holds the object information
 */
function prepareObjectArray(json_data) {
     // Currently only the center-top position is calculated if not given by json data. This is
     // the position over which the object information is displayed.
    json_data.forEach(function(obj) {
        // Upper left corner of the object
        var x1 = null;
        var y1 = null;

        // X position of the lower right corner of the object
        var x2 = 0;

        obj.areas.forEach(function(area) {
            if (x1 > area.x || x1 == null) x1 = area.x;
            if (y1 > area.y || y1 == null) y1 = area.y;
            if (x2 < (area.x + area.width)) x2 = area.x + area.width;
        });

        if (!obj.pointer_x) obj.pointer_x = x1 + (x2 - x1)/2;
        if (!obj.pointer_y) obj.pointer_y = y1;
    });

    return json_data;
}

/**
 * Check whether a given (mouse) position hovers an object and reacts to that by
 * either show the object info div or hiding it.
 * @param {number} vx - X position (of the mouse pointer) in view space
 * @param {number} vy - Y position (of the mouse pointer) in view space
 */
function mouseHoverObjectHandler(vx, vy) {
    var ix = vx*(ih*posz/vh) + posx;
    var iy = vy*(ih*posz/vh) + posy;
    var hovered_object = null;

    objects.forEach(function(o) {
        o.areas.forEach(function(a) {
            if ((ix >= a.x && ix <= (a.x + a.width)) && (iy >= a.y && iy <= (a.y + a.height))) {
                hovered_object = o;
            }
        });
    });

    if (hovered_object != last_hovered_object) {
        if (draw_object_areas_on_mouseover) draw(); // Re-draw the current frame to erase the areas of the last hovered object

        if (hovered_object == null) {
            hideObjectInformation();
        } else {
            showObjectInformation(hovered_object);
            if (draw_object_areas_on_mouseover) drawObjectAreas(null, hovered_object);
        }
        last_hovered_object = hovered_object;
    }
}

/**
 * Fills the object info div with information of the given object and displays the div.
 * @param {object} obj - JavaScript object that holds the information of the object whose information is to be displayed
 */
function showObjectInformation(obj) {
    var html = "<table>";

    html += "<tr><th colspan=\"2\">" + obj.name + "</th><tr>";

    if (obj.add_name) {
        html += "<tr><td colspan=\"2\" class=\"add_name\">" + obj.add_name + "</td><tr>";
    }

    if (obj.location) {
        html += "<tr><td>Adresse:</td><td>" + obj.location + "</td><tr>";
    }

    if (obj.distance) {
        html += "<tr><td>Entfernung:</td><td>" + obj.distance + "</td><tr>";
    }

    html += "</table>";

    objinfo_div.html(html);

    var x = (obj.pointer_x - posx)*(vh/(ih*posz)) - objinfo_div.outerWidth()/2;
    var y = (obj.pointer_y - posy)/(ih*posz/vh) - objinfo_div.outerHeight() - 12; // Add 12 extra pixels for the arrow at the bottom

    objinfo_div.css({top: y, left: x});
    objinfo_div.show();
}

/**
 * Hide the object info div
 */
function hideObjectInformation() {
    objinfo_div.hide();
}

/**
 * Preparing the compass by calculating points and creating Path2D objects. The later increases performance.
 */
function prepareCompass() {
  var radius_inner_circle = 7;
  var radius_mid_circle = 30;
  var radius_letter_circle = 33;
  var radius_back_circle = 50;

  var px_mid_circle = [];
  var py_mid_circle = [];

  var px_inner_circle = [];
  var py_inner_circle = [];

  // Calculate coordinates of all required points
  for (var p = 0.0; p <= Math.PI*2; p += Math.PI/2) {
    px_mid_circle.push(Math.sin(p) * radius_mid_circle);
    py_mid_circle.push(Math.cos(p) * radius_mid_circle);

    px_letter_circle.push(Math.sin(p) * radius_letter_circle);
    py_letter_circle.push(Math.cos(p) * radius_letter_circle);

    px_inner_circle.push(Math.sin(p + Math.PI/4) * radius_inner_circle);
    py_inner_circle.push(Math.cos(p + Math.PI/4) * radius_inner_circle);
  }

  // Prepare background circle
  var path2d = new Path2D();

  path2d.arc(0, 0, radius_back_circle, 0, Math.PI * 2, true);
  compass_path2d.push(path2d);

  // Prepare north arrow
  var path2d = new Path2D();

  path2d.moveTo(0, 0);
  path2d.lineTo(px_inner_circle[1], py_inner_circle[1]);
  path2d.lineTo(px_mid_circle[2], py_mid_circle[2]);
  path2d.lineTo(px_inner_circle[2], py_inner_circle[2]);
  path2d.closePath();

  compass_path2d.push(path2d);

  // Prepare west to east arrows
  var path2d = new Path2D();

  path2d.moveTo(0, 0);
  path2d.lineTo(px_inner_circle[2], py_inner_circle[2]);
  path2d.lineTo(px_mid_circle[3], py_mid_circle[3]);
  path2d.lineTo(px_inner_circle[3], py_inner_circle[3]);
  path2d.lineTo(px_mid_circle[0], py_mid_circle[0]);
  path2d.lineTo(px_inner_circle[0], py_inner_circle[0]);
  path2d.lineTo(px_mid_circle[1], py_mid_circle[1]);
  path2d.lineTo(px_inner_circle[1], py_inner_circle[1]);
  path2d.closePath();

  compass_path2d.push(path2d);
}

/**
 * Draws the compass
 * @param {object} ctx - 2d context
 * @param {number} x - X position of the compass center
 * @param {number} y - Y position of the compass center
 * @param {number} d - Compass pointing direction in radians (0 to 2*Pi); 0 means north; Pi/2 equals west and so on
 */
function drawCompass(ctx, x, y, d) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(d);

  // Draw all PAth2D objects
  for (var i = 0; i < compass_path2d.length; i++) {
    switch (i) {
      case 0:
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        break;
      case 1:
        ctx.fillStyle = 'red';
        break;
      default:
        ctx.fillStyle = 'black';
    }

    ctx.fill(compass_path2d[i]);
  }

  ctx.font = '12px serif';
  ctx.fillStyle = 'red';
  ctx.fillText('N', px_letter_circle[2] - 5, py_letter_circle[2]);
  ctx.fillStyle = 'black';
  ctx.fillText('S', px_letter_circle[0] - 4, py_letter_circle[0] + 9);
  ctx.fillText('O', px_letter_circle[1] - 2, py_letter_circle[1] + 5);
  ctx.fillText('W', px_letter_circle[3] - 10, py_letter_circle[3] + 5);

  ctx.restore();
}

/**
 * Draw all areas of an object as red rectangles
 * @param {object} ctx - 2d context. If null the 2d context is retrieved from the canvas element automatically
 * @param {object} obj - JavaScript object with holds the object whose areas are to be drawn
 */
function drawObjectAreas(ctx, obj) {
    if (ctx == null) ctx = canvas.getContext('2d');

    ctx.strokeStyle = 'red';

    obj.areas.forEach(function(a) {
        ctx.strokeRect((a.x-posx)/(ih*posz/vh), (a.y-posy)/(ih*posz/vh), a.width/(ih*posz/vh), a.height/(ih*posz/vh));
    });
}

/**
 * Performs the loading animation while the image is downloading until animation_running is set to false. The loading
 * animation is a rotating compass and a text that informs the user that image downloading is in progress.
 * @param {number} rad - Current angel of the compass in radians
 */
function loadingAnimation(rad=0.0) {
    if (!animation_running) {
        return;
    }

    var x = vw/2;
    var y = vh/2;

    ctx2d.fillStyle = 'white';
    ctx2d.arc(x, y, 50, 0, Math.PI * 2, true);
    ctx2d.fill();

    drawCompass(ctx2d, x, y, rad);

    ctx2d.save();
    ctx2d.font = '32px serif';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'top';
    ctx2d.fillStyle = 'black';
    ctx2d.fillText('Bild wird geladen. Bitte warten...', x, y + 75);
    ctx2d.restore();

    if (animation_running) {
        setTimeout(loadingAnimation, 50, rad + 0.1);
    }
}

/**
 * Main draw function. Draws the clipping area of the panorama image and other
 * things to the canvas element.
 */
function draw() {
    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');

        // For x (vertical) axis infinit scrolling is supported. If the area where
        // left and right end of the picture meet is visible, we need special handling.
        if (posx < 0) {
            ctx.drawImage(pano, iw+posx-1, posy, vr*ih*posz, posz*ih, 0, 0, vw, vh);
        }

        ctx.drawImage(pano, posx, posy, vr*ih*posz, posz*ih, 0, 0, vw, vh);

        drawCompass(ctx, vw - 75, 75, ((Math.PI*2)/iw)*(nx_pos-vw/2*ih*posz/vh-posx));

        if (draw_all_object_areas) {
            objects.forEach(function(o) {
                drawObjectAreas(ctx, o);
            });
        }
    }
}
