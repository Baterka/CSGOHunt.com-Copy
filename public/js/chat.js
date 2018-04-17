var emots = [
    {
        src: "/img/emots/fail.png",
        txt: ":fail:"
    },
    {
        src: "/img/emots/hs.png",
        txt: ":hs:"
    },
    {
        src: "/img/emots/rekt.png",
        txt: ":rekt:"
    },
    {
        src: "/img/emots/dead.png",
        txt: ":dead:"
    },
    {
        src: "/img/emots/lol.png",
        txt: ":lol:"
    },
    {
        src: "/img/emots/gg.png",
        txt: ":gg:"
    },
    {
        src: "/img/emots/rip.png",
        txt: ":rip:"
    },
    {
        src: "/img/emots/duck.png",
        txt: ":duck:"
    },
    {
        src: "/img/emots/lucky.png",
        txt: ":lucky:"
    },
    {
        src: "/img/emots/dollars.png",
        txt: ":dollars:"
    }, {
        src: "/img/emots/chan.png",
        txt: ":chan:"
    },
    {
        src: "/img/emots/salt.png",
        txt: ":salt:"
    },
    {
        src: "/img/emots/facepalm.png",
        txt: ":facepalm:"
    },
    {
        src: "/img/emots/kappa.png",
        txt: ":kappa:"
    },
    {
        src: "/img/emots/illuminati.png",
        txt: ":illuminati:"
    }
];
String.prototype.replaceAll = function (str1, str2, ignore) {
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "\\$&"), (ignore ? "gi" : "g")), (typeof(str2) == "string") ? str2.replace(/\$/g, "$$$$") : str2);
};

function sendMsg() {
    var cin = $("#chatInput");
    var msg = cin.val();
    if (!msg) return;
    if (msg.charAt(0) === "/") {
        var data = msg.substr(1, msg.length - 1).split(' ');
        switch (data[0]) {
            case'help':
                pushChatNotification("Available commands are: mute [steamid] / unmute [steamid]");
                break;
            case'mute':
                if (!data[1]) return pushChatNotification("Usage: /mute STEAM_ID");
                var sid = data[1].trim();
                if (window.localStorage) {
                    var ig = JSON.parse(localStorage.getItem("ignore_list")) || [];
                    ig.push(sid);
                    localStorage.setItem("ignore_list", JSON.stringify(ig));
                    pushChatNotification("Message from steam ID " + sid + " will be ignored.");
                }
                break;
            case'unmute':
                if (!data[1]) return pushChatNotification("Usage: /unmute STEAM_ID");
                var sid = data[1].trim();
                if (window.localStorage) {
                    var ig = JSON.parse(localStorage.getItem("ignore_list")) || [];
                    var idx = ig.indexOf(sid);
                    if (idx !== -1) {
                        ig.splice(idx, 1);
                        localStorage.setItem("ignore_list", JSON.stringify(ig));
                        pushChatNotification("ID " + data[1] + " removed from ignore list.");
                    }
                    else pushChatNotification(sid + " is not in your ignore list.");
                }
                break;
            default:
                pushChatNotification("Unknown command, type /help for more informations");
        }
        cin.val("");
        return;
    }
    window.chatIO.emit("sendMessage", {message: msg});
    cin.val("");
}

function pushChatNotification(message) {
    var cMsg = $("#chatMessages");
    var s = document.createElement("div");
    s.setAttribute("class", "alert alert-info");
    s.innerHTML = message;
    cMsg.append(s);
    scrollChat();
}

function fMessage(elem) {
    var message = elem.find(".chat-content");
    for (var t in emots) {
        if (message.html().indexOf(emots[t].txt) !== -1) {
            var img = '<img src="' + emots[t].src + '" width="32" height="32" />';
            var html = message.html();
            var fstr = html.replaceAll(emots[t].txt, img);
            message.html(fstr);
        }
    }
    var str_trim;
    var str = message.html();
    str = str.replace(/ +(?= )/g, '');
    str = str.replace(/(https:\/\/|http:\/\/)steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+\&amp;token=[a-zA-Z0-9._-]+/ig, "❤");
    str = str.replace(/(?!csgohunt\.com)csgo\w*\.\w*|csgo\w*\. \w*|csgo\w* \.\w*|csgo\w* \. \w*|csgo-\w*\.\w*|skinarena|failsnipe|CSGET|reaper|bubble|csgobubble|r3aper|re4per|reap3r|csgowild|skinsbit|csgomaya|csgoreaper|casesfarm|СSВООМ|csgoshuffle|Snakego|winpot|w i n p o t|boom|skinsrate|skins-case|CS B OO M|ezskins\.com|loveskins\.gq|skinrush\.net|csgorigged\!com|skinsgambling\.com|www\.dotajackpots\.com/ig, "❤");
    str_trim = str.replace(/\s/g, '');
    str_trim = str_trim.replace(/[\u0080-\u00ff]/g, '');
    if (/csget.*?org/ig.test(str_trim)) {
        str = "❤";
    }
    if (/csgo.*?reaper/ig.test(str_trim)) {
        str = "❤";
    }
    if (/http.*?deposit/ig.test(str_trim)) {
        str = "❤";
    }
    if (/http.*?free/ig.test(str_trim)) {
        str = "❤";
    }
    if (/http.*?dollar/ig.test(str_trim)) {
        str = "❤";
    }
    if (/click.*?name/ig.test(str_trim)) {
        str = "❤";
    }
    if (/click.*?profile/ig.test(str_trim)) {
        str = "❤";
    }
    if (/goo.gl/ig.test(str_trim)) {
        str = "❤";
    }
    if (/bit.ly/ig.test(str_trim)) {
        str = "❤";
    }
    if (/reaper/ig.test(str_trim)) {
        str = "❤";
    }
    if (/bubble/ig.test(str_trim)) {
        str = "❤";
    }
    if (/shuffle.*?code|code.*?shuffle/ig.test(str))
        str = "❤";
    if (/boom.*?code|code.*?boom/ig.test(str))
        str = "❤";
    if (/hunt.*?info/ig.test(str))
        str = "❤";
    if (/cs.*?com/ig.test(str))
        str = "❤";
    if (/cs.*?B OO M/ig.test(str))
        str = "❤";
    if (/c s.*?B OO M/ig.test(str))
        str = "❤";
    if (/cs.*?B O O M/ig.test(str))
        str = "❤";
    if (/c s.*?B O O M/ig.test(str))
        str = "❤";
    if (/c s.*?B OO M/ig.test(str))
        str = "❤";
    if (/POT.*?p w/ig.test(str))
        str = "❤";
    if (/bit.*com/ig.test(str))
        str = "❤";
    if (/PO T.*?pw/ig.test(str))
        str = "❤";
    if (/get.*?org/ig.test(str))
        str = "❤";
    if (/cs.*?deposit/ig.test(str))
        str = "❤";
    if (/free.*?code/ig.test(str))
        str = "❤";
    if (/org.*?free/ig.test(str))
        str = "❤";
    if (/org.*deposit/ig.test(str))
        str = "❤";
    if (/c s.*free/ig.test(str))
        str = "❤";
    if (/cs.*free/ig.test(str))
        str = "❤";
    if (/bet.*?anomaly/ig.test(str))
        str = "❤";
    if (/P O T.*?pw/ig.test(str))
        str = "❤";
    if (/P O T.*?p w/ig.test(str))
        str = "❤";
    if (/PO T.*?p w/ig.test(str))
        str = "❤";
    if (/POT.*?p w/ig.test(str))
        str = "❤";
    if (/cases.*?com/ig.test(str))
        str = "❤";
    if (/case.*?com/ig.test(str))
        str = "❤";
    if (/csgo.*?wild/ig.test(str))
        str = "❤";
    if (/maya.*?com/ig.test(str))
        str = "❤";
    if (/maya.*?con/ig.test(str))
        str = "❤";
    if (/farm.*?com/ig.test(str))
        str = "❤";
    if (/POT.*?pw/ig.test(str))
        str = "❤";
    if (/P OT.*?pw/ig.test(str))
        str = "❤";
    if (/skins.*?promo/ig.test(str))
        str = "❤";
    if (/skins.*?case/ig.test(str))
        str = "❤";
    if (/skins.*?code/ig.test(str))
        str = "❤";
    if (/case.*?code/ig.test(str))
        str = "❤";
    if (/.com.*?code/ig.test(str))
        str = "❤";
    if (/B.O.O.M|B.O.OM|BO.OM|BOO.M|B.OOM/ig.test(str))
        str = "❤";
    if (/coinz.*?code|code.*?coinz/ig.test(str))
        str = "❤";
    if (/cs.*?code|code.*?cs/ig.test(str))
        str = "❤";
    if (/free.*?code|code.*?free/ig.test(str))
        str = "❤";
    if (/csgoshuffle.*?code|code.*?csgoshuffle/ig.test(str))
        str = "❤";
    if (/csgo.*?fight/ig.test(str))
        str = "❤";
    if (/new lottery/ig.test(str))
        str = "❤";
    if (/csgodouble/ig.test(str))
        str = "❤";
    if (/csgomode|csgo mode|\*LOWPOTS\*|0.10\$ Min Deposit|Jackpot Deisgn|VD8die5Ka5|New Awesome|ZeoASNTThF|jackpot design/ig.test(str))
        str = "❤";
    if (/unusual design|Min \$ 0\.1|Fight for skins|csgobull|Consumer Grade|Dreaming of expensive/ig.test(str))
        str = "❤";
    if (/msi-esl|msi -esl|msi- esl|msi - esl/ig.test(str))
        str = "❤";
    if (/csgorides/ig.test(str))
        str = "❤";
    if (/csgoskinswin/ig.test(str))
        str = "❤";
    if (/csgo.*?rides/ig.test(str))
        str = "❤";
    if (/csgo.*?ride/ig.test(str))
        str = "❤";
    if (/csgored/ig.test(str))
        str = "❤";
    if (/\(\.\)/ig.test(str))
        str = "❤";
    if (/get free/ig.test(str))
        str = "❤";
    if (/min deposit/ig.test(str))
        str = "❤";
    if (/csgo.*? com/ig.test(str))
        str = "❤";
    if (/http:\/\//ig.test(str))
        str = "❤";
    if (/fair new/ig.test(str))
        str = "❤";
    if (/site :\)/ig.test(str))
        str = "❤";
    if (/dune10/ig.test(str))
        str = "❤";
    if (/5\$ enjoy/ig.test(str))
        str = "❤";
    if (/! @@/ig.test(str))
        str = "❤";
    if (/remove spaces/ig.test(str))
        str = "❤";
    if (/CS BO OM/ig.test(str))
        str = "❤";
    if (/minimal deposit/ig.test(str))
        str = "❤";
    if (/new site/ig.test(str))
        str = "❤";
    if (/skins2\.com/ig.test(str))
        str = "❤";
    if (/skins2.*?com/ig.test(str))
        str = "❤";
    if (/skinsrumble.*?com/ig.test(str))
        str = "❤";
    if (/(?=.*C\s*S\s*|.*C\s*.\s*S\s*)(?=.*B\s*.\s*O\s*.\s*O\s*.M\s*|.*B\s*.\s*O\s*.\s*O\s*M\s*|.*B\s*O\s*\s*O\s*M\s*|.*B\s*O\s*O\s*.\s*M\s*|.*B\s*.\s*O\s*O\s*M\s*|.*B\s*O\s*O\s*M\s*|.*B\s*O\s*.\s*O\s*O\s*M|.*BOO.M|.*B\s*O\s*.\s*O\s*M\s*).*/ig.test(str))
        str = "❤";
    if (/[СВМℂṦᏰΌʍÇŜ฿ΘḾ]/ig.test(str))
        str = "❤";
    if (/[\u2E80-\u2FD5\u3400-\u4DBF\u4E00-\u9FCC]/.test(str)) {
        str = str;
    }
    else if (/[\u0250-\ue007]/ig.test(str)) {
        str = "❤";
    }
    str = str.replace(/shuffle/ig, "❤");
    message.html(str);
}

function scrollChat() {
    var elem = document.getElementById("chatMessages");
    elem.scrollTop = elem.scrollHeight;
}

function renderMsg(data) {
    var src = $("#chat-message-tpl").html();
    var tpl = Handlebars.compile(src);
    var tmp_name;
    data.from.displayName = data.from.displayName.replace(/(?!csgohunt\.com)csgo\w*\.\w*|csgo-\w*\.\w*|skinarena|failsnipe|reaper|boom|winpot|win pot|CSGOCrystal|skinsrate|ezskins\.com|loveskins\.gq|skinrush\.net|csgoraffle\.pl|csgorigged\!com|skinsgambling\.com|www\.dotajackpots\.com|csgoduck|c s g o r e d \. c o m|SkinsGambling\.com|kickback\.com|winaskin\.com/ig, "❤");
    if (/sanehouse/ig.test(data.from.displayName))
        data.message = "❤";
    if (/POT.*?p w|PO T.*?pw|P O T.*?pw|P O T.*?p w|PO T.*?p w|POT.*?pw|P OT.*pw/ig.test(data.from.displayName))
        data.message = "❤";
    if (/cs.*?B OO M|c s.*?B OO M|cs.*?B O O M|c s.*?B O O M|c s.*?B OO M|cs.*bo om|csgohunt.*info|csgo hunt.*info/ig.test(data.from.displayName))
        data.message = "❤";
    if (/PUBGCasino/ig.test(data.from.displayName))
        data.message = "❤";
    tmp_name = data.from.displayName.replace(/\s/g, '');
    if (/csget.*?org/ig.test(tmp_name)) {
        data.message = "❤";
        data.from.displayName = "❤";
    }
    var cMsg = $("#chatMessages");
    var html = $(tpl(data));
    if (data.privilege == "admin")
        html.find(".chat-user").attr("style", "color: #C9302C;");
    fMessage(html);
    cMsg.append(html);
}

function appendSmiley(elm) {
    var cin = $("#chatInput");
    cin.val(cin.val() + $(elm).data("txt"));
}

function showRules() {
    var src = $(".confirm-modal").html();
    var tpl = Handlebars.compile(src);
    var modal = $(tpl());
    modal.find("h4").html("Chat rules");
    modal.find(".modal-body").append("<p>Not respecting the following rules will get you banned permanently.</p><ul><li>No begging</li><li>No advertising/links</li><li>No spamming</li></ul>");
    modal.find(".modal-footer .btn-cancel").html("Close");
    modal.find(".modal-footer .btn-confirm").remove();
    modal.modal('show');
    modal.on("hidden.bs.modal", function (e) {
        modal.remove();
    });
}

$(function () {
    var cw = $("#chatWindow");
    var cbtn = $("#chatBtn");
    $(cbtn).on("click", function (e) {
        cw.show();
        cbtn.hide();
        scrollChat();
    });
    $("#chatSendBtn").on("click", function (e) {
        sendMsg();
    });
    $('#chatInput').keypress(function (evt) {
        if (evt.which === 13)
            sendMsg();
    });
    var ems = '<div style="text-align: center;">';
    for (var i = 0; i < emots.length; i++) {
        var em = emots[i];
        ems += '<img class="emot" src="' + em.src + '" onclick="appendSmiley(this);" data-txt="' + em.txt + '" width="25" height="25" />';
    }
    ems += "</div>";
    $('#chatEmotsBtn').popover({content: ems, placement: "top", html: true});
    var socket = window.chatIO = io(window.Application.sockets.chat);
    var cStatus = $("#chatStatus");
    socket.on("connected", function (data) {
        var cMsg = $("#chatMessages").html('');
        cStatus.attr("class", "online");
        cStatus.find(".statusLine").html("Online");
        for (var k in data) {
            renderMsg(data[k]);
        }
        scrollChat();
        var uData = window.Application;
        if (uData.stk) socket.emit("authenticate", {stk: uData.stk, sid: uData.sid});
    });
    socket.on('connect_error', function () {
        cStatus.attr("class", "offline");
        cStatus.find(".statusLine").html("Offline");
    });
    socket.on('reconnect_failed', function () {
        cStatus.attr("class", "offline");
        cStatus.find(".statusLine").html("Offline");
    });
    socket.on('chatMsg', function (data) {
        if (window.localStorage) {
            var s = localStorage.getItem("ignore_list");
            s = s ? JSON.parse(s) : [];
            if (s.indexOf(data.from.steamID) !== -1) return;
        }
        renderMsg(data);
        scrollChat();
    });
    socket.on("userCount", function (count) {
        cStatus.find(".statusLine").html("Online - " + count);
    });
    socket.on('chatBroadcast', function (data) {
        var cMsg = $("#chatMessages");
        var s = document.createElement("div");
        s.setAttribute("class", "alert alert-info");
        s.innerHTML = data.message;
        cMsg.append(s);
        scrollChat();
    });
    socket.on('chatError', function (data) {
        var cMsg = $("#chatMessages");
        var s = document.createElement("div");
        s.setAttribute("class", "alert alert-danger");
        s.innerHTML = data.message;
        cMsg.append(s);
        scrollChat();
    });
});