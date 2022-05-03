var canvas = null;
var wrapper = null;
var pano = null;
var vw = null;
var vh = null;
var vr = null; // View ratio

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
            draw();
        }
        pano.src = img_url;
    }
}

function draw() {
    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');
        var iw = pano.width;
        var ih = pano.height;
        var s = vh / ih;

        ctx.drawImage(pano, 0, 0, vr*ih, ih, 0, 0, vw, vh);
    }
}