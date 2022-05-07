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

/**
 * Init function for the Kolkturm Viewer 360 called once the page has loaded
 * @param {string} wrapper_id - ID of the wrapper element (usually <div />) which wrapps the <canvas /> element
 * @param {string} canvas_id - ID of the <canvas /> element (main drawing area)
 * @param {string} img_url - URL pointing to the panorama image file
 */
function initKolkViewer(wrapper_id, canvas_id, img_url) {
    wrapper = $("#" + wrapper_id).get(0);
    canvas = $("#" + canvas_id).get(0);

    vw = $(wrapper).width();
    vh = $(wrapper).height();
    vr = vw/vh;

    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');

        canvas.width = vw;
        canvas.height = vh;

        ctx.font = '48px serif';
        ctx.fillText('Lade...', 10, 50);

        pano = new Image();
        pano.onload = function() {
            iw = pano.width;
            ih = pano.height;
            minz = vh / ih;
            draw();
        }
        pano.src = img_url;
    }

    $(document).keydown(keyHandler);
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
            zoom(-0.01);
            draw();
            break;
        case 109: // Minus
        case 173:
            zoom(0.01);
            draw();
            break;
    }
}

/**
 * Changes the zoom factor relatively
 * @param {number} zi - z increment (positive number = zoom out;  negative number = zoom in)
 */
function zoom(zi) {
    var oldz = posz;

    posz = Math.min(Math.max(posz + zi, minz), 1);

    // Keep center centered while zooming
    movex((oldz*vr*ih - posz*vr*ih)/2);
    movey((oldz*ih - posz*ih)/2);
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