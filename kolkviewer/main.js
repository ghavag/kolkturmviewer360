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

            canvas.width = vw;
            cw = canvas.clientWidth;
            iw = img.width;
            s = cw / iw;
            ctx.drawImage(img, 0, 0, 1800, s*img.height);
        }
        img.src = 'img/kolkturm360.png';
    }
}
