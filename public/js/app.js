function askTradeurl() {
    if (!window.Application.sid)
        return;
    if (!window.Application.ntd)
        return;
    var modal = new CModal();
    modal.init({
        title: "One more thing...", confirmLabel: "Save my trade url", closeOnConfirm: false, confirmCallback: function () {
            var resultDiv = modal.elem.find(".form-result").html("");
            var turl = modal.elem.find("#tradeurl").val();
            if (!turl) return resultDiv.html('<div class="alert alert-danger">You need to enter something first.</div>');
            var sbtn = modal.elem.find(".btn-confirm");
            resultDiv.html("");
            sbtn.button("loading");
            $.ajax({
                method: "POST", url: "/api/update-profile", dataType: "json", data: {tradeurl: turl, _csrf: $("#csrf").val()}, success: function (data) {
                    if (data.result) {
                        resultDiv.html('<div class="alert alert-success">Trade URL saved! Please wait...</div>')
                        return setTimeout(function () {
                            window.location.reload();
                        }, 1000);
                    }
                    resultDiv.html('<div class="alert alert-danger">' + data.message + '</div>');
                    sbtn.button("reset");
                }, error: function (xhr, status, err) {
                    sbtn.button("reset");
                    var errorStr = err || ("HTTP error: " + status);
                    resultDiv.html('<div class="alert alert-danger">' + errorStr + '</div>');
                }
            });
        }
    });
    var tpl = Handlebars.compile($("#turl-modal-content").html());
    var content = tpl({steamid: window.Application.sid});
    modal.setContent(content);
    modal.show();
}

const LevelColors = {
    0: {bg: "#3a3f44", txt: "#fff"},
    10: {bg: "#4E342E", txt: "#fff"},
    20: {bg: "#009688", txt: "#fff"},
    30: {bg: "#FF5722", txt: "#fff"},
    40: {bg: "#FF5722", txt: "#fff"},
    50: {bg: "#C2185B", txt: "#fff"},
    60: {bg: "#C2185B", txt: "#fff"},
    70: {bg: "#00695C", txt: "#fff"},
    80: {bg: "#00695C", txt: "#fff"},
    90: {bg: "#FFEB3B", txt: "#000"},
    100: {bg: "#4B69FF", txt: "#fff"},
    200: {bg: "#8847FF", txt: "#fff"},
    300: {bg: "#D32CE6", txt: "#fff"},
    max: {bg: "#EB4B4B", txt: "#fff"}
};

function getLevelClass(lvl) {
    var range = lvl - lvl % 100;
    if (range < 100) {
        var l = lvl % 100;
        range = l - l % 10;
    }
    return LevelColors.hasOwnProperty(range) ? LevelColors[range] : LevelColors.max;
}

Number.prototype.format = function (n, x) {
    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
    return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
};

function shuffleArray(a) {
    var j, x, i;
    for (i = a.length; i; i -= 1) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

Number.prototype.asCurrency = function () {
    return '<img src="/img/coins-green.png" width="32"/> ' + this.toFixed(2);
};

function toggleSidePanel() {
    $("#main-content").toggleClass("panel-open");
    $("#right-panel").toggleClass("panel-open");
    var sp = $("#sp-toggle i.arrow");
    if (sp.hasClass("fa-chevron-right")) {
        sp.attr("class", "fa fa-chevron-left arrow");
    }
    else sp.attr("class", "fa fa-chevron-right arrow");
}

$(function () {
    $('[data-toggle="tooltip"]').tooltip();
    var ws = io("/");
    ws.on("currentlyPlayed", function (data) {
        var jtotal = $(".jackpot-total");
        var cftotal = $(".cf-total");
        if (data.jackpot_total !== jtotal.data("value")) {
            jtotal.data("value", data.jackpot_total);
            jtotal.html(data.jackpot_total / 100);
            if (data.jackpot_total === 0)
                return jtotal.fadeOut();
            if (!jtotal.is(":visible")) return jtotal.fadeIn();
            jtotal.effect("highlight", {color: '#f58380'});
        }
        if (data.cf_total !== cftotal.data("value")) {
            cftotal.data("value", data.cf_total);
            cftotal.html(data.cf_total / 100);
            if (data.cf_total === 0)
                return cftotal.fadeOut();
            if (!cftotal.is(":visible")) return cftotal.fadeIn();
            cftotal.effect("highlight", {color: '#f58380'});
        }
    });
    var rp = $("#right-panel");
    if (rp.length) {
        var w = $(window);
        var sp = $('#sp-toggle');
        if (w.width() < 1380 && rp.hasClass("panel-open"))
            toggleSidePanel();
        w.resize(function () {
            if (w.width() < 1380 && rp.hasClass("panel-open"))
                toggleSidePanel();
        });
        sp.on("click", function () {
            toggleSidePanel();
        });
        $("#minimize-chat").on("click", function () {
            toggleSidePanel();
        });
    }
});

function openLoginModal() {
    var lmodal = new CModal();
    lmodal.init({large: true, isConfirm: false});
    var content = Handlebars.compile($("#tpl-login-modal").html());
    lmodal.setContent(content);
    lmodal.show();
}

function initiateAltLogin() {
    var req = $.ajax({method: "POST", body: {steamid: $("#login-steam-id").val()}, url: "/async/alt-login-init", dataType: "json"});
    req.done(function (data) {
        var ctn = $("#alt-login-result");
        if (data.error) return ctn.text(data.error);
        $("#login-init-btn").hide();
        $("#login-verify-btn").show();
        ctn.html("Please add <strong>" + data.auth_token + "</strong> to your name and click the verify button below  to login.");
    });
}

function verifyLogin() {
    var req = $.ajax({method: "get", url: "/async/verify-login", dataType: "json"});
    req.done(function (data) {
        if (data.error) return $("#alt-login-result").text(data.error);
        console.log(data);
    });
}