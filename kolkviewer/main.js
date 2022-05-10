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
var mousex = null;
var mousey = null;
var mouseclicked = false;

/**
 * Init function for the Kolkturm Viewer 360 called once the page has loaded
 * @param {string} wrapper_id - ID of the wrapper element (usually <div />) which wrapps the <canvas /> element
 * @param {string} canvas_id - ID of the <canvas /> element (main drawing area)
 * @param {string} data_url - URL pointing to the json file which is the central information base
 */
function initKolkViewer(wrapper_id, canvas_id, data_url) {
    var json_request = new XMLHttpRequest();

    wrapper = $("#" + wrapper_id).get(0);
    canvas = $("#" + canvas_id).get(0);

    vw = $(wrapper).width();
    vh = $(wrapper).height();
    vr = vw/vh;

    pano = new Image();

    pano.onload = function() {
        iw = pano.width;
        ih = pano.height;
        minz = vh / ih;
        draw();
    }

    // All required information is stored in a json file,
    // even the panorama picture source URL
    json_request.open('GET', data_url);
    json_request.responseType = 'json';
    json_request.send();

    json_request.onload = function() {
        pano.src = json_request.response['pano_url'];
    }

    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');

        canvas.width = vw;
        canvas.height = vh;

        ctx.font = '48px serif';
        ctx.fillText('Lade...', 10, 50);
    }

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
    movex((posz*vr*ih - vr*ih)/2); // Keep center centered while reset zoom factor
    posy = 0;
    posz = 1.0;
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
 * Main draw function. Draws the clipping area of the panorama image and other
 * things to the canvas element.
 */
function draw() {
    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');

        // For x (vertical) axis infinit scrolling is supported. If the area where
        // left and right end of the picture meet is visible, we need special handling.
        if (posx < 0) {
            ctx.drawImage(pano, iw+posx, posy, vr*ih*posz, posz*ih, 0, 0, vw, vh);
        }

        ctx.drawImage(pano, posx, posy, vr*ih*posz, posz*ih, 0, 0, vw, vh);
    }
}