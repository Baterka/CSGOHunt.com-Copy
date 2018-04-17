$(function () {
    for (var i = 0; i < bets.length; i++){
        var bet = bets[i];
        bet.items.sort(function (a, b) {
            return a.price < b.price;
        });
        var poContent = "";
        for (var k in bet.items) {
            var itm = bet.items[k];
            var wrp = '<div class="b-preview">';
            wrp += '<img src="' + itm.img + '" width="60" />';
            wrp += '<div class="price">' + itm.price + '</div>';
            wrp += '</div>';
            poContent += wrp;
        }
        $("div[data-offer=" + bet.offerID + "]").popover({content: poContent, html: true, placement: "left", trigger: "hover"});
    }
});