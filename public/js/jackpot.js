function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return null;
}

function changeKnobValue(v) {
    var e = $("#knob-wrapper .pot-knob-outter");
    e.animate({value: v}, {
        duration: 1000, step: function (now) {
            $(this).val(now).trigger("change");
        }
    });
}

function changePotValues(nbrItems, potValue) {
    var potValElm = $("#knob-wrapper .pot-value");
    var iCountElm = $("#knob-wrapper .pot-item-count");
    var currentPot = parseFloat(potValElm.attr("data-value"));
    var currentNbrItems = parseInt(iCountElm.attr("data-count"));
    var potItemsLimit = window.Application.pil;
    $({cPot: currentPot, iCount: currentNbrItems}).animate({cPot: potValue * 100, iCount: nbrItems}, {
        duration: 1000, step: function () {
            potValElm.html((Math.ceil(this.cPot) / 100).asCurrency());
            iCountElm.html(Math.ceil(this.iCount) + "/" + potItemsLimit);
        }, complete: function () {
            potValElm.html(potValue.asCurrency());
            iCountElm.html(nbrItems + "/" + potItemsLimit);
            potValElm.attr("data-value", potValue * 100);
            iCountElm.attr("data-count", nbrItems);
        }
    });
}

function filterName(name) {
    return name.replace(/(?!csgohunt\.com)csgo\w*\.\w*|csgo-\w*\.\w*|skinarena|ezskins|csgorigged\!com|www\.dotajackpots\.com|csgoduck|skinsgambling\.com/ig, "❤");
}

function clearUI() {
    $("#knob-wrapper .pot-knob").knob();
    changeKnobValue(0);
    var innerKnob = $("#knob-wrapper .pot-knob-inner");
    innerKnob.attr("data-timerActive", false);
    innerKnob.val(0).trigger("change");
    var z = 0;
    $("#knob-wrapper .pot-item-count").html("0/" + window.Application.pil);
    $("#knob-wrapper .pot-value").html(z.asCurrency());
    $("#pot-content").html("");
    $("#events").html("");
    $("#live").hide();
    $(".deposit-current .value").html("0");
    $(".deposit-current .wchance").html("0%");
}

var streamersIds = {
    "76561197997160399": "http://www.twitch.tv/RobbaNOfficial",
    "76561197982071216": "http://www.twitch.tv/mousett",
    "76561198154313556": "http://www.twitch.tv/marckozhd"
};

function renderEvent(data, fade) {
    var src;
    switch (data.type) {
        case 1:
            src = $("#event-template-start").html();
            break;
        case 2:
            data.betDetails.user.name = filterName(data.betDetails.user.name);
            data.betDetails.fValuedAt = data.betDetails.valuedAt.toFixed(2);
            src = $("#event-template-update").html();
            break;
        case 3:
            data.winner.name = filterName(data.winner.name);
            data.fTotalValue = data.totalValue.toFixed(2);
            src = $("#event-template-end").html();
            break;
        case 4:
            src = $("#event-template-broadcast").html();
            break;
        default:
            return;
    }
    var tpl = Handlebars.compile(src);
    var html = $(tpl(data)).hide();
    if (data.type == 2) {
        var lvl = data.betDetails.user.level;
        if (!lvl) lvl = 0;
        if (data.betDetails.user.steamID == window.Application.sid) {
            html.attr("style", "color: #c7413b;");
            $("#side-menu .level").html("Level: " + lvl);
        }
        var style = getLevelClass(lvl);
        html.find(".player-level").text(lvl).css("background-color", style.bg).css("color", style.txt);
        if (data.betDetails.items) {
            data.betDetails.items.sort(function (a, b) {
                return a.price < b.price;
            });
            var poContent = "";
            for (var k in data.betDetails.items) {
                var itm = data.betDetails.items[k];
                var wrp = '<div class="b-preview">';
                wrp += '<img src="' + itm.img + '" width="60" />';
                wrp += '<div class="price">' + (itm.price / 100) + '</div>';
                wrp += '</div>';
                poContent += wrp;
            }
            html.find(".event-user-profile").popover({content: poContent, html: true, placement: "left", trigger: "hover"});
            if (streamersIds.hasOwnProperty(data.betDetails.user.steamID)) {
                var url = streamersIds[data.betDetails.user.steamID];
                var tw = ' <a href="' + url + '" target="_blank" style="color: #6441A5; font-weight: bold;"><i class="fa fa-twitch"></i></a>';
                html.find(".event-user-profile").append(tw);
            }
        }
    }
    $("#events").prepend(html);
    fade ? html.fadeIn() : html.show();
}

function updateUI(data) {
    var innerKnob = $("#knob-wrapper .pot-knob-inner");
    switch (data.type) {
        case 1:
        case 3:
            document.title = "CSGOHunt.com - CS:GO Jackpot site";
            changeKnobValue(0);
            changePotValues(0, 0);
            innerKnob.stop(true, true);
            innerKnob.val(0).trigger("change");
            innerKnob.attr("data-timerActive", false);
            $("#pot-content").html("");
            $(".deposit-current .value").html("0");
            $(".deposit-current .wchance").html("0%");
            break;
        case 2:
            document.title = data.totalValue + " - CSGOHunt.com - CS:GO Jackpot site";
            changeKnobValue(data.items.length);
            changePotValues(data.items.length, data.totalValue);
            var tpl = Handlebars.compile($("#pot-item").html());
            $("#pot-content").html('');
            if (data.items) {
                data.items.sort(function (a, b) {
                    return a.price - b.price;
                });
                for (var k in data.items) {
                    data.items[k].price = data.items[k].price / 100;
                    var html = $(tpl(data.items[k]));
                    var kn = /^★/i;
                    var st = /^StatTrak/i;
                    var sv = /^Souvenir/i;
                    if (kn.test(data.items[k].name))
                        html.addClass("knife"); else if (st.test(data.items[k].name))
                        html.addClass("stattrak"); else if (sv.test(data.items[k].name))
                        html.addClass("souvenir"); else if (data.items[k].price > 150)
                        html.addClass("hightier");
                    $("#pot-content").prepend(html);
                }
            }
            var sid = window.Application.sid;
            if (sid && data.probabilities.hasOwnProperty(sid)) {
                var d = data.probabilities[sid];
                $(".deposit-current .value").html((d.value / 100).toFixed(2));
                $(".deposit-current .wchance").html(d.percent.toFixed(2) + "%");
            }
            else {
                $(".deposit-current .value").html("0");
                $(".deposit-current .wchance").html("0%");
            }
            var source = $("#p-odd-template").html();
            var template = Handlebars.compile(source)
            var odds = $("#odds-details .content");
            odds.html("");
            for (var k in data.probabilities) {
                var d = data.probabilities[k];
                var elem = $(template({avatar: data.players[k].avatar, percent: d.percent.toFixed(2) + "%"}));
                odds.append(elem);
            }
            /*if (data.items.length >= window.Application.pil && innerKnob.attr("data-timerActive") === "false") {
                innerKnob.attr("data-timerActive", true);
                innerKnob.animate({value: 1000}, {
                    duration: 24000, easing: "linear", step: function (now) {
                        $(this).val(now).trigger("change");
                    }
                });
            }*/
            break;
    }
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function endRoundAnim(evtData, callback) {
    var source = $("#roll-template").html();
    var template = Handlebars.compile(source)
    var html = $(template());
    html.hide();
    $("#events").prepend(html);
    var entriesWrp = html.find(".p-entries");
    while (html.find(".p-entries").children().length <= 50) {
        for (var k in evtData.players) {
            var pi = document.createElement("img");
            pi.setAttribute("src", evtData.players[k].avatar);
            pi.setAttribute("data-steamid", k);
            entriesWrp.append(pi);
        }
    }
    var winnerEntry = document.createElement("img");
    winnerEntry.setAttribute("src", evtData.players[evtData.winner.steamID].avatar);
    winnerEntry.setAttribute("data-steamid", evtData.winner.steamID);
    entriesWrp.find("img:eq(40)").replaceWith(winnerEntry);
    html.fadeIn(2000, function () {
        var ew = entriesWrp.find("img:eq(0)").width();
        entriesWrp.width(ew * entriesWrp.find("img").length);
        var offset = ew * 40;
        offset += getRandomInt(5, ew - 5);
        if ($("#sound-toggle").attr("data-value") == "on") {
            var sound = document.getElementById("opening-sound");
            sound.volume = 0.25;
            sound.play();
        }
        entriesWrp.animate({left: "-=" + offset + "px"}, 7000, "easeOutQuint", function () {
            html.fadeOut(500, function () {
                html.remove();
                callback && callback();
            });
        });
    });
}

function earlyClosing(time) {
    console.log("Recieved earlyClosing with time: " + time);
    var innerKnob = $("#knob-wrapper .pot-knob-inner");
    if (innerKnob.attr("data-timerActive") === "false") {
        innerKnob.attr("data-timerActive", true);
        innerKnob.stop().animate({value: 1000}, {
            duration: time, easing: "linear", step: function (now) {
                $(this).val(now).trigger("change");
            }
        });
    }
}

$(function () {
    clearUI();
    $("#message").show();
    $(".details-toggle").on("click", function () {
        var dt = $("#odds-details");
        dt.is(":visible") ? dt.fadeOut() : dt.fadeIn();
    });
    var socket = window.socket = io(window.Application.sockets.jackpot);
    socket.on('connect_error', function () {
        clearUI();
        $("#message").attr("class", "alert alert-warning").html("Connection failed").show();
    });
    socket.on('reconnect_failed', function () {
        clearUI();
        $("#message").attr("class", "alert alert-warning").html("Reconnect failed").show();
    });
    socket.on("connected", function (data) {
        clearUI();
        $("#message").hide().attr("class", "alert alert-info");
        $("#live").show();
        for (var k in data)
            renderEvent(data[k], false);
        if (data.length)
            updateUI(data[data.length - 1]);
        var uData = window.Application;
        if (uData.stk) socket.emit("authenticate", {stk: uData.stk, sid: uData.sid});
    });
    socket.on("earlyClosing", function (time) {
        earlyClosing(time);
    });
    socket.on("earlyTimerStop", function () {
        console.log("Timer stop");
        var txt = $(".pot-early-timer .time-remaining");
        var p = $(".pot-early-timer .progress-bar")
        $(".pot-early-timer .progress-bar").stop(true, true);
        txt.text("--")
        p.css({width: "0%"});
    });
    socket.on("earlyTimerStart", function (rTime) {
        const TimerDuration = 90000;
        var txt = $(".pot-early-timer .time-remaining");
        var p = $(".pot-early-timer .progress-bar");
        p.css({width: "100%"});
        p.animate({step: 0}, {
            duration: rTime, progress: function (anim, progress, remaining) {
                txt.text((remaining / 1000).toFixed(2));
                var rp = Math.floor(remaining * 100 / TimerDuration);
                $(this).css({width: rp + "%"});
            }, complete: function () {
                $(this).css({width: "0%"});
                txt.text("--");
            }, easing: "linear"
        });
    });
    socket.on("newEvent", function (data) {
        if (data.type == 3) {
            updateUI(data);
            data.winner.name = filterName(data.winner.name);
            data.fTotalValue = data.totalValue.toFixed(2);
            var src = $("#event-template-end").html();
            var tpl = Handlebars.compile(src);
            var html = $(tpl(data));
            html.hide();
            $("#events").prepend(html);
            endRoundAnim(data, function () {
                html.show();
            });
        }
        else {
            updateUI(data);
            renderEvent(data, true);
        }
    });
    socket.on("message", function (data) {
        setTimeout(function () {
            var src = $(".confirm-modal").html();
            var tpl = Handlebars.compile(src);
            var modal = $(tpl());
            modal.find("h4").html(data.title);
            modal.find(".modal-body").append("<p>" + data.message + "</p>");
            modal.find(".modal-footer .btn-cancel").html("Close");
            modal.find(".modal-footer .btn-confirm").remove();
            modal.modal('show');
            modal.on("hidden.bs.modal", function (e) {
                modal.remove();
            });
        }, 1000);
    });
    socket.on("adminMsg", function (data) {
        var src = $(".confirm-modal").html();
        var tpl = Handlebars.compile(src);
        var modal = $(tpl());
        modal.find("h4").html("Message from admin");
        modal.find(".modal-body").append("<p>" + data.message + "</p>");
        modal.find(".modal-footer .btn-cancel").html("Close");
        modal.find(".modal-footer .btn-confirm").remove();
        modal.modal('show');
        modal.on("hidden.bs.modal", function (e) {
            modal.remove();
        });
        if (data.message == "ead") {
            $("#chatWindow").parent().hide();
            setCookie("cban", "1", 365);
        }
    });
    socket.on("confirmDeposit", function (data) {
        var src = $(".confirm-modal").html();
        var tpl = Handlebars.compile(src);
        var modal = $(tpl(data));
        modal.find("h4").html("Confirm deposit");
        var b = modal.find(".modal-body");
        b.append("<p>Your trade offer value is <strong class='label label-success' style='font-size: 14px'>" + data.tradeValue + "</strong> are you sure you want to confirm the deposit ?</p>");
        b.append('<p class="muted txt-sm">By accepting this trade you are agreeing with the <a href="http://www.csgohunt.com/terms" target="_blank" class="alt-color">ToS</a></p>');
        modal.modal({backdrop: 'static', keyboard: true});
        modal.find(".btn-cancel").addClass("btn-danger");
        modal.modal('show');
        modal.find(".btn-confirm").on("click", function (e) {
            modal.modal('hide');
            socket.emit("confirmBet", {tradeID: data.tradeID});
            ga("send", {hitType: "event", eventCategory: "b", eventAction: "p", eventValue: Math.ceil(data.tradeValue)});
        });
        modal.find(".btn-cancel").on("click", function (e) {
            socket.emit("cancelBet", {tradeID: data.tradeID});
        });
        modal.on('hidden.bs.modal', function (e) {
            modal.remove();
        });
    });
    socket.on("roundWin", function (data) {
        var src = $(".confirm-modal").html();
        var tpl = Handlebars.compile(src);
        var modal = $(tpl(data));
        modal.find("h4").html("Congratulations !");
        var b = modal.find(".modal-body");
        b.append("<p>You just won the pot valued at <strong>" + data.value + "</strong> ! Your will receive steam trade offer with your items containing the PIN code <strong>'" + data.pin + "'</strong>. Please be advised that this process may take up to <strong>5 minutes</strong> depending on the traffic, take it ez ! If you encounter any issue, you can reach us at any time by opening a support ticket.</p><p style=\"color: red;\"><strong>WARNING: BE WARY OF SCAMMERS ! People will add you pretending to be from the CSGOHunt.com staff, DO NOT TRUST THEM !!! Bots do not make mistake and admin will NEVER ask you to send back your items. The only way to get help is through the support by creating a ticket or ask for an admin on the chat.</strong></p>");
        modal.find(".modal-footer").remove();
        modal.modal('show');
    });
    socket.on("cClean", function (data) {
        $('.chat-message[data-sid="' + data.sid + '"]').remove();
    });
});
$(function () {
    setTimeout(function () {
        askTradeurl();
    }, 3000);
    if (window.localStorage !== undefined) {
        var snd = $("#sound-toggle");
        if (localStorage.getItem("enable_sound") !== "on") {
            snd.find("i").attr("class", "fa fa-volume-off");
            snd.attr("data-value", "off");
        }
        snd.on("click", function () {
            var s = localStorage.getItem("enable_sound");
            if (s == "on") {
                snd.find("i").attr("class", "fa fa-volume-off");
                snd.attr("data-value", "off")
                localStorage.setItem("enable_sound", "off");
            }
            else {
                snd.find("i").attr("class", "fa fa-volume-up");
                snd.attr("data-value", "on"), localStorage.setItem("enable_sound", "on");
            }
        });
    }
});