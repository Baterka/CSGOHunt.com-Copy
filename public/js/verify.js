$(function () {
    $("#verify-btn").on("click", function () {
        var data = {hash: $("#hash").val(), secret: $("#secret").val(), percent: $("#percent").val(), nbrTickets: $("#nbrTickets").val()};
        if (CryptoJS.MD5(data.percent + ":" + data.secret) == data.hash) {
            var wt = Math.floor((data.nbrTickets - 0.0000000001) * (data.percent / 100));
            alert("The winning ticket can be found at position " + wt);
        }
        else alert("Hash doesn't match.");
    });
    if (window.location.hash) {
        var data = window.location.hash.substring(1).split(';');
        $("#hash").val(data[0]), $("#secret").val(data[1]), $("#percent").val(data[2]), $("#nbrTickets").val(data[3])
    }
});