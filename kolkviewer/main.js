function draw() {
    var canvas = document.getElementById('ktv');
    if (canvas.getContext) {
        var ctx = canvas.getContext('2d');

        ctx.font = '48px serif';
        ctx.fillText('Lade...', 10, 50);

        var img = new Image();
        img.onload = function() {
            vw = $( wktv ).width();
            vh = $( wktv ).height();
            vr = vw/vh; // View ratio

            canvas.width = vw;
            canvas.height = vh;

            cw = canvas.clientWidth;
            iw = img.width;
            ih = img.height;
            s = vh / ih;
            ctx.drawImage(img, 0, 0, vr*ih, ih, 0, 0, vw, vh);
        }
        img.src = 'img/kolkturm360.png';
    }
}
