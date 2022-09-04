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

class KolkturmViewer {
    static instantiated = false;

    canvas = null;
    ctx2d = null;
    wrapper = null;
    pano = null; // The DOM object representing the panorama picture
    vw = null; // View (canvas) width
    vh = null; //   and height
    vr = null; // View ratio
    iw = null; // Image width
    ih = null; //   and height
    posx = 0; // X and
    posy = 0; //   y position of the clipping area
    posz = 1.0; // Z position (zoom factor)
    minz = null; // Minimum z position
    nx_pos = null; // The position at the x axis where north is located
    mousex = null;
    mousey = null;
    mouseclicked = false;

    /**
     * Indicates that an animation is in progress. Running animations MUST
     * stop if that variable is set to false. Also animations MUST set this
     * variable to false after they complete.
     */
    animation_running = false;

    objects = [];
    last_hovered_object = null;
    objinfo_div = null;
    draw_all_object_areas = false;
    draw_object_areas_on_mouseover = false;

    /**
     * Init function for the Kolkturm Viewer 360 called once the page has loaded
     * @param {string} data_url - URL pointing to the json file which is the central information base
     */
    constructor(data_url) {
        // There are better ways to implement a singleton pattern in JavaScript. That way
        // keeps the code a little bit cleaner.
        if (KolkturmViewer.instantiated) {
            throw new Error("Class " + this.constructor.name + " can only be instantiated once.");
        } else {
            KolkturmViewer.instantiated = true;
        }

        var json_request = new XMLHttpRequest();

        this.wrapper = $("#kolkturmviewer");
        this.canvas = $("<canvas>").appendTo(this.wrapper).get(0);
        this.ctx2d = this.canvas.getContext('2d');
        this.objinfo_div = $("<div>", { class: "ktv-objinfo" }).appendTo(this.wrapper);

        this.vw = $(this.wrapper).width();
        this.vh = $(this.wrapper).height();
        this.vr = this.vw/this.vh;

        this.pano = new Image();

        this.pano.onload = (() => {
            this.iw = this.pano.width;
            this.ih = this.pano.height;
            this.movex(-(this.vw/2*this.ih*this.posz/this.vh-this.nx_pos)); // That takes the north direction into the view center
            this.animation_running = false; // Stop loading animation
            this.resizeHandler();
        });

        // All required information is stored in a json file,
        // even the panorama picture source URL
        json_request.open('GET', data_url);
        json_request.responseType = 'json';
        json_request.send();

        json_request.onload = (() => {
            this.nx_pos = json_request.response['north_xposition'];
            this.pano.src = json_request.response['pano_url'];
            this.objects = this.prepareObjectArray(json_request.response['objects']);
        });

        // Even thought those properties will also be set by the resizeHandler() it is necessary to set
        // this here (before the image has loaded) in order to display the load animation correctly.
        this.canvas.width = this.vw;
        this.canvas.height = this.vh;

        this.prepareCompass();

        this.animation_running = true;
        this.loadingAnimation();

        // Setting up handlers
        $(document).keydown(this.keyHandler.bind(this));
        $(this.canvas).mousewheel(this.mouseWheelHandler.bind(this));
        $(this.canvas).mousedown(this.mouseDownHandler.bind(this));
        $(this.canvas).mousemove(this.mouseHoverObjectHandler.bind(this));
        $(document).mouseup(this.mouseUpHandler.bind(this)); // Mouse up event must be bound to the document
        $(document).mousemove(this.mouseMoveHandler.bind(this)); // See comment above
        $(window).resize(this.resizeHandler.bind(this));
    }

    /**
     * Event handler to react on browser window resize event called by the browser
     */
    resizeHandler() {
        $(this.wrapper).css({'max-width': this.iw+"px"});
        this.vw = $(this.wrapper).width();

        $(this.wrapper).css({'min-height': Math.ceil((this.vw*this.ih)/this.iw)+"px"});
        $(this.wrapper).css({'max-height': this.ih+"px"});
        this.vh = $(this.wrapper).height();

        var newvr = this.vw/this.vh;
        var deltavr = this.vr - newvr;
        this.vr = newvr;

        this.minz = this.vh / this.ih;

        this.canvas.width = this.vw;
        this.canvas.height = this.vh;

        // Correct x position such that the middle of the current
        // clipping area stays in the middle of the view area.
        this.movex((deltavr*this.ih*this.posz)/2);

        // posz needs correction if it got out of range. Also posx needs correction then.
        if (this.posz < this.minz) {
            this.movex((this.vr*this.ih*(this.posz - this.minz))/2);
            this.posz = this.minz;
        }

        this.draw();
    }

    /**
     * Event handler for mouse move events regarding the whole document called by the
     * browser
     * @param {object} event - Object with information about the mouse move event
     */
    mouseMoveHandler(event) {
        if (this.mouseclicked) {
            if (this.mousex != null && this.mousey != null) {
                var deltax = (this.mousex - event.pageX)*(this.ih*this.posz/this.vh);
                var deltay = (this.mousey - event.pageY)*(this.ih*this.posz/this.vh);
                this.movex(deltax);
                this.movey(deltay);
                this.draw();
            }

            this.mousex = event.pageX;
            this.mousey = event.pageY;
            this.animation_running = false;
        }
    }

    /**
     * Event handler for mouse move events regarding the canvas element called by the
     * browser. Checks whether a given (mouse) position hovers an object and reacts to
     * that by either show the object info div or hiding it.
     * @param {object} event - Object with information about the mouse move event
     */
    mouseHoverObjectHandler(event) {
        if (this.mouseclicked)  {
            this.hideObjectInformation();
            return;
        }

        var ix = event.pageX*(this.ih*this.posz/this.vh) + this.posx;
        var iy = event.pageY*(this.ih*this.posz/this.vh) + this.posy;
        var hovered_object = null;

        this.objects.forEach(function(o) {
            o.areas.forEach(function(a) {
                if ((ix >= a.x && ix <= (a.x + a.width)) && (iy >= a.y && iy <= (a.y + a.height))) {
                    hovered_object = o;
                }
            });
        });

        if (hovered_object != this.last_hovered_object) {
            if (this.draw_object_areas_on_mouseover) this.draw(); // Re-draw the current frame to erase the areas of the last hovered object

            if (hovered_object == null) {
                this.hideObjectInformation();
            } else {
                this.showObjectInformation(hovered_object);
                if (this.draw_object_areas_on_mouseover) this.drawObjectAreas(hovered_object);
            }
            this.last_hovered_object = hovered_object;
        }
    }

    /**
     * Event handler for mouse button down events called by the browser
     * @param {object} event - Object with information about the mouse button event
     */
    mouseDownHandler(event) { // Left mouse button
        this.mouseclicked = (event.which == 1);
    }

    /**
     * Event handler for mouse button up events called by the browser
     * @param {object} event - Object with information about the mouse button event
     */
    mouseUpHandler(event) {
        if (event.which == 1) { // Left mouse button
            this.mouseclicked = false;
            this.mousex = this.mousey = null;
        }
    }

    /**
     * Event handler for mouse wheel events called by the browser
     * @param {object} event - Object with information about the mouse wheel event
     */
    mouseWheelHandler(event) {
        this.zoom(event.deltaY*event.deltaFactor/-10000, event.pageX/this.vw, event.pageY/this.vh);
        this.draw();
    }

    /**
     * Event handler for keyboard key down events called by the browser
     * @param {object} event - Object with information about the key
     */
    keyHandler(event) {
        console.log("event.which: " + event.which + " event.keyCode: " + event.keyCode);
        switch (event.which) {
            case 27: // Escape
                this.animation_running = false; // Cancel all running animations
                break;
            case 37: // Left
                this.movex(-10);
                this.draw();
                break;
            case 39: // Right
                this.movex(10);
                this.draw();
                break;
            case 38: // Up
                this.movey(-10);
                this.draw();
                break;
            case 40: // Down
                this.movey(+10);
                this.draw();
                break;
            case 48: // Zero
            case 96:
                this.resetZoom();
                this.draw();
                break;
            case 107: // Plus
            case 171:
                this.zoom(-0.01, 0.5, 0.5);
                this.draw();
                break;
            case 109: // Minus
            case 173:
                this.zoom(0.01, 0.5, 0.5);
                this.draw();
                break;
            case 78: // N - North position
                this.moveToCompassPosition('N');
                break;
            case 69: // E - East position
            case 79: // O - Ost (east in German) position
                this.moveToCompassPosition('O');
                break;
            case 83: // S - South position
                this.moveToCompassPosition('S');
                break;
            case 87: // W - West position
                this.moveToCompassPosition('W');
                break;
        }
    }

    /**
     * Changes the zoom factor relatively
     * @param {number} zi - z increment (positive number = zoom out;  negative number = zoom in)
     * @param {number} fx - Fix point at the x axis while zooming (valid values between 0 and 1)
     * @param {number} fy - Fix point at the y axis while zooming (valid values between 0 and 1)
     */
    zoom(zi, fx, fy) {
        var oldz = this.posz;

        this.posz = Math.min(Math.max(this.posz + zi, this.minz), 1);

        // Keep center centered while zooming
        this.movex((oldz*this.vr*this.ih - this.posz*this.vr*this.ih)*fx);
        this.movey((oldz*this.ih - this.posz*this.ih)*fy);
    }

    /**
     * Resets the zoom factor to the initial value
     */
    resetZoom() {
        var oldz = this.posz;

        this.posy = 0;
        this.posz = 1.0;

        this.movex((oldz*this.vr*this.ih - this.vr*this.ih)/2); // Keep center centered while reset zoom factor
    }

    /**
     * Relatively moves the clipping area on the y (horizontal) axis
     * @param {number} yi - y increment (positive number = move down;  negative number = move up)
     */
    movey(yi) {
        this.posy = Math.min(Math.max(this.posy + yi, 0), this.ih - this.posz*this.ih);
    }

    /**
     * Relatively moves the clipping area on the x (vertical) axis
     * @param {number} xi - x increment (positive number = to the right;  negative number = to the left)
     */
    movex(xi) {
        this.posx += xi;
        var maxx = this.iw - this.vr*this.ih*this.posz;

        // For x (vertical) axis support infinit scrolling.
        if (this.posx > maxx) {
            this.posx = -this.vr*this.ih*this.posz + (this.posx - maxx);
        } else if (this.posx < -(this.vr*this.ih*this.posz)) {
            this.posx = maxx + (this.posx + this.vr*this.ih*this.posz);
        }
    }

    /**
     * Moves the center view position to the given compass direction
     * @param {character} cpos - A character out of [nNeEoOsSwW], e.g. 'n' for north
     */
    moveToCompassPosition(cpos) {
        const north_pos = this.nx_pos-this.vw/2*this.ih*this.posz/this.vh;
        var tpos = 0; // Target position
        var movdir = 1;
        var dist;

        switch (cpos) {
            case 'n', 'N':
                tpos = north_pos;
                break;
            case 'e', 'E', 'o', 'O':
                tpos = north_pos + this.iw/4;
                break;
            case 's', 'S':
                tpos = north_pos + this.iw/4*2;
                break;
            case 'w', 'W':
                tpos = north_pos + this.iw/4*3;
                break;
            default:
                return;
        }

        if (tpos > this.posx) { // Target position is to the right from current position
            dist = tpos - this.posx;

            // Distance is shorter if moving the the left
            if (dist > (this.posx + this.iw - tpos)) {
                dist = this.posx + this.iw - tpos;
                movdir = -1;
            }
        } else {
            dist = this.posx - tpos;
            movdir = -1;

            // Distance is shorter if moving to the right
            if (dist > (tpos + this.iw - this.posx)) {
                dist = tpos + this.iw - this.posx;
                movdir = 1;
            }
        }

        this.animation_running = true;
        this.animatedMoveToXPos(dist, movdir);
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
    animatedMoveToXPos(dist, movdir=0, cov=0, speed=0, acc=1) {
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
        this.movex(movdir * speed);

        if (cov < dist && this.animation_running) {
            setTimeout(this.animatedMoveToXPos.bind(this), 50, dist, movdir, cov, speed, acc);
        } else {
            this.animation_running = false;
        }

        this.draw();
    }

    /**
     * The information about objects is beeing fetched from json data. This function supplements data
     * which is optional or can be calculated from given data.
     * @param {object} json_data - Json object which holds the object information
     */
    prepareObjectArray(json_data) {
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
     * Fills the object info div with information of the given object and displays the div.
     * @param {object} obj - JavaScript object that holds the information of the object whose information is to be displayed
     */
    showObjectInformation(obj) {
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

        this.objinfo_div.html(html);

        var x = (obj.pointer_x - this.posx)*(this.vh/(this.ih*this.posz)) - this.objinfo_div.outerWidth()/2;
        var y = (obj.pointer_y - this.posy)/(this.ih*this.posz/this.vh) - this.objinfo_div.outerHeight() - 12; // Add 12 extra pixels for the arrow at the bottom

        this.objinfo_div.css({top: y, left: x});
        this.objinfo_div.show();
    }

    /**
     * Hide the object info div
     */
    hideObjectInformation() {
        this.objinfo_div.hide();
    }

    /**
     * Preparing the compass by calculating points and creating Path2D objects. The later increases performance.
     */
    prepareCompass() {
        this.compass_path2d = [];
        this.px_letter_circle = [];
        this.py_letter_circle = [];

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

            this.px_letter_circle.push(Math.sin(p) * radius_letter_circle);
            this.py_letter_circle.push(Math.cos(p) * radius_letter_circle);

            px_inner_circle.push(Math.sin(p + Math.PI/4) * radius_inner_circle);
            py_inner_circle.push(Math.cos(p + Math.PI/4) * radius_inner_circle);
        }

        // Prepare background circle
        var path2d = new Path2D();

        path2d.arc(0, 0, radius_back_circle, 0, Math.PI * 2, true);
        this.compass_path2d.push(path2d);

        // Prepare north arrow
        var path2d = new Path2D();

        path2d.moveTo(0, 0);
        path2d.lineTo(px_inner_circle[1], py_inner_circle[1]);
        path2d.lineTo(px_mid_circle[2], py_mid_circle[2]);
        path2d.lineTo(px_inner_circle[2], py_inner_circle[2]);
        path2d.closePath();

        this.compass_path2d.push(path2d);

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

        this.compass_path2d.push(path2d);
    }

    /**
     * Draws the compass
     * @param {number} x - X position of the compass center
     * @param {number} y - Y position of the compass center
     * @param {number} d - Compass pointing direction in radians (0 to 2*Pi); 0 means north; Pi/2 equals west and so on
     */
    drawCompass(x, y, d) {
        this.ctx2d.save();
        this.ctx2d.translate(x, y);
        this.ctx2d.rotate(d);

        // Draw all PAth2D objects
        for (var i = 0; i < this.compass_path2d.length; i++) {
            switch (i) {
            case 0:
                this.ctx2d.fillStyle = 'rgba(200, 200, 200, 0.5)';
                break;
            case 1:
                this.ctx2d.fillStyle = 'red';
                break;
            default:
                this.ctx2d.fillStyle = 'black';
            }

            this.ctx2d.fill(this.compass_path2d[i]);
        }

        this.ctx2d.font = '12px serif';
        this.ctx2d.fillStyle = 'red';
        this.ctx2d.fillText('N', this.px_letter_circle[2] - 5, this.py_letter_circle[2]);
        this.ctx2d.fillStyle = 'black';
        this.ctx2d.fillText('S', this.px_letter_circle[0] - 4, this.py_letter_circle[0] + 9);
        this.ctx2d.fillText('O', this.px_letter_circle[1] - 2, this.py_letter_circle[1] + 5);
        this.ctx2d.fillText('W', this.px_letter_circle[3] - 10, this.py_letter_circle[3] + 5);

        this.ctx2d.restore();
    }

    /**
     * Draw all areas of an object as red rectangles
     * @param {object} obj - JavaScript object with holds the object whose areas are to be drawn
     */
    drawObjectAreas(obj) {
        this.ctx2d.strokeStyle = 'red';

        obj.areas.forEach(function(a) {
            this.ctx2d.strokeRect((a.x-this.posx)/(this.ih*this.posz/this.vh), (a.y-this.posy)/(this.ih*this.posz/this.vh), a.width/(this.ih*this.posz/this.vh), a.height/(this.ih*this.posz/this.vh));
        }.bind(this));
    }

    /**
     * Performs the loading animation while the image is downloading until animation_running is set to false. The loading
     * animation is a rotating compass and a text that informs the user that image downloading is in progress.
     * @param {number} rad - Current angel of the compass in radians
     */
    loadingAnimation(rad=0.0) {
        if (!this.animation_running) {
            return;
        }

        var x = this.vw/2;
        var y = this.vh/2;

        this.ctx2d.fillStyle = 'white';
        this.ctx2d.arc(x, y, 50, 0, Math.PI * 2, true);
        this.ctx2d.fill();

        this.drawCompass(x, y, rad);

        this.ctx2d.save();
        this.ctx2d.font = '32px serif';
        this.ctx2d.textAlign = 'center';
        this.ctx2d.textBaseline = 'top';
        this.ctx2d.fillStyle = 'black';
        this.ctx2d.fillText('Bild wird geladen. Bitte warten...', x, y + 75);
        this.ctx2d.restore();

        if (this.animation_running) {
            setTimeout(this.loadingAnimation, 50, rad + 0.1);
        }
    }

    /**
     * Main draw function. Draws the clipping area of the panorama image and other
     * things to the canvas element.
     */
    draw() {
        // For x (vertical) axis infinit scrolling is supported. If the area where
        // left and right end of the picture meet is visible, we need special handling.
        if (this.posx < 0) {
            this.ctx2d.drawImage(this.pano, this.iw+this.posx-1, this.posy, this.vr*this.ih*this.posz, this.posz*this.ih, 0, 0, this.vw, this.vh);
        }

        this.ctx2d.drawImage(this.pano, this.posx, this.posy, this.vr*this.ih*this.posz, this.posz*this.ih, 0, 0, this.vw, this.vh);

        this.drawCompass(this.vw - 75, 75, ((Math.PI*2)/this.iw)*(this.nx_pos-this.vw/2*this.ih*this.posz/this.vh-this.posx));

        if (this.draw_all_object_areas) {
            this.objects.forEach(function(o) {
                this.drawObjectAreas(o);
            }.bind(this));
        }
    }
}
