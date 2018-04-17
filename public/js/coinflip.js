/* global $ io CModal Handlebars localStorage */
const INV_CACHE_EXPIRE = 1000 * 60 * 60 * 12; //For auto refresh
const MAX_REFRESH = 1000 * 60; //For spam refresh
const MIN_BET_VALUE = 200;
const JOIN_MARGIN = 0.10;
const JOIN_TIME = 60 * 2 + 5;
const EDuelStatus = {
    OPENING: 0,
    OPEN: 1,
    JOINING: 2,
    CLOSED: 3,
    SENT: 4,
    ACCEPTED: 5,
    CANCELED: 6
};

function generateSeed() {
    var n = parseInt(Math.random().toString().split(".")[1], 10);
    return n.toString(16);
}

function ItemsPicker(rValue, side) {
    this.itemTpl = Handlebars.compile($("#tpl-inv-item").html());
    this.invTpl = Handlebars.compile($("#tpl-inv").html());
    this.modal = new CModal();
    this.modal.init({altTheme: true, large: true});

    this.confirmCallback = null;
    this.rValue = rValue;
    this.side = side;
    this.initModal();
}

ItemsPicker.prototype.setConfirmCallback = function (cb) {
    this.confirmCallback = cb;
};

ItemsPicker.prototype.initModal = function () {
    var self = this;
    var modal = this.modal;
    var rValue = this.rValue;
    modal.setContent(self.invTpl());
    modal.elem.find(".modal-footer").remove();
    modal.elem.find(".btn-send").on("click", function () {
        self.createOffer();
    });
    modal.elem.find(".btn-cancel").on("click", function () {
        modal.hide();
    });
    modal.elem.find(".btn-refresh").on("click", function () {
        var b = $(this);
        b.button('loading');
        self.fetchAndCacheInventory(function (error, items) {
            b.button('reset');
            if (error) return self.showMessage("danger", error);

            self._clearSelected();
            self._loadInv(items);
        });
    });
    modal.elem.find(".btn-clear").on("click", function () {
        self._clearSelected();
    });

    if (!rValue) {
        modal.elem.find(".join-info").remove();
        modal.elem.find(".modal-title").html("Create duel");
    }
    else {
        modal.elem.find(".modal-title").html("Join duel");
        var oside = self.side == "ct" ? "t" : "ct";
        modal.elem.find(".side-info").html('<h5>Joining as</h5> <img src="/img/' + oside + '-side.png" width="32"/>');
        var imin = rValue * (1 - JOIN_MARGIN);
        var imax = rValue * (1 + JOIN_MARGIN);
        var rStr = (imin / 100).toFixed(2);
        rStr += " to ";
        rStr += (imax / 100).toFixed(2);
        modal.elem.find(".p-range").html(rStr);
    }

    modal.elem.find(".player-seed input").val(generateSeed());

    modal.show();
    var c = '<h3 class="text-center">Loading inventory...</h3>';
    var iContent = modal.elem.find(".inv-content");
    iContent.html(c);

    var delta = Date.now() - localStorage.getItem("invTs");
    if (delta < INV_CACHE_EXPIRE) {
        var items = JSON.parse(localStorage.getItem("inventory"));
        if (items) {
            console.log("Rendering cached inv.");
            return self._loadInv(items);
        }
    }

    self.fetchAndCacheInventory(function (err, items) {
        if (err) return iContent.find("h3").html("Failed to load inventory: " + err);
        self._loadInv(items);
    });
};

ItemsPicker.prototype.showMessage = function (level, message, keepOpen) {
    var d = $("<div></div>");
    d.html(message);
    d.prop("class", 'alert alert-' + level);
    this.modal.elem.find(".status-message").html(d);
    setTimeout(function () {
        var dd = $(d);
        if (!keepOpen) dd.fadeOut(function () {
            dd.remove();
        });
    }, 10000);
};

ItemsPicker.prototype.createOffer = function () {
    var modal = this.modal;
    var rValue = this.rValue;
    var total = 0, ids = [];
    var itemElems = modal.elem.find(".item.selected");
    /*if (!itemElems.length)
        return this.showMessage("warning", "No items selected");
*/
    itemElems.each(function () {
        var e = $(this);
        ids.push(e.data("asset-id"));
        total += parseInt(e.data("price"), 10);
    });
/*
    if (rValue) {
        var imax = rValue * (1 + JOIN_MARGIN);
        var imin = rValue * (1 - JOIN_MARGIN);

        if (total > imax || total < imin)
            return this.showMessage("warning", "Your offer doesn't match the required value.");
    }
    else if (total < 500)
        return this.showMessage("warning", "The minimum bet value is 5.00");
*/
    var seed = modal.elem.find(".player-seed input").val();
    /*if (!seed.length)
        return this.showMessage("warning", "Invalid seed length");
    if (!/^[a-zA-Z0-9]*$/ig.test(seed))
        return this.showMessage("warning", "Invalid seed characters: only A-Z and numbers are allowed");
*/
    var side = modal.elem.find('.side-info input[name="side"]:checked').val();
    this.confirmCallback && this.confirmCallback(ids, seed, side, modal.elem.find(".autocancel").is(":checked"));
};

ItemsPicker.prototype.renderItems = function (items) {
    var self = this;
    var html = $("<div></div>");
    items.forEach(function (item) {
        item.fprice = (item.price / 100).toFixed(2);

        var e = $(self.itemTpl(item));
        if (self.isBlacklisted(item.name))
            e.addClass("blacklisted");

        html.append(e);
    });
    return html;
};

ItemsPicker.prototype.isBlacklisted = function (name) {
    if (/^Souvenir/ig.test(name)) return true;
    if (/^Sticker/ig.test(name)) return true;
    if (/^Graffiti/ig.test(name)) return true;
    if (/(?!Operation Hydra Case Key)(?!Operation Wildfire Case Key)^Operation/ig.test(name)) return true;
    if (/ Case$/ig.test(name)) return true;
    if (/^MLG|^ESL|^Cologne|^EMS|^Enfu|Souvenir Package$|Capsule$/ig.test(name)) return true;
    return false;
};

ItemsPicker.prototype.fetchAndCacheInventory = function (callback) {
    var lastCache = localStorage.getItem("invTs");
    /*if(lastCache && Date.now() - lastCache < MAX_REFRESH)
        return callback("You can only refresh once every minute");*/

    console.log("Fetching inventory...");
    $.ajax({
        method: "GET",
        url: "/api/get-inventory",
        data: {
            sid: window.Application.sid,
            appId: 578080
        },
        success: function (resp) {
            console.log(resp);
            if (resp.error)
                return callback(resp.error);

            localStorage.setItem("invTs", Date.now());
            localStorage.setItem("inventory", JSON.stringify(resp.data));
            callback(null, resp.data);
        },
        error: function (xhr, status, err) {
            callback(err || status);
        }
    });
};

ItemsPicker.prototype._clearSelected = function () {
    var modal = this.modal;
    modal.elem.find(".item.selected").removeClass("selected");
    modal.elem.find(".to-value").html("0.00");
    modal.elem.find(".to-hint").html("");
    modal.elem.find(".w-chances").html("--%");
    modal.elem.data("selected-total", 0);
};

ItemsPicker.prototype._loadInv = function (items) {
    var self = this;
    var modal = this.modal;
    var html = self.renderItems(items);
    var now = Date.now();
    var delta = (now - localStorage.getItem("invTs")) / 1000;
    delta = Math.floor(delta / 60);

    modal.elem.find(".refresh-info").html("Last refresh: " + delta + " minutes ago");
    modal.elem.find(".inv-content").html(html);
    self._bindItemsEvent();
};

ItemsPicker.prototype._bindItemsEvent = function () {
    var total = 0;
    var modal = this.modal;
    var rValue = this.rValue;
    //Bind events
    modal.elem.find(".inv-content .item").each(function () {
        var elem = $(this);
        if (elem.hasClass("blacklisted"))
            return;

        //Toggle class
        elem.on("click", function () {
            var e = $(this);
            var stotal = parseInt(modal.elem.data("selected-total"), 10);
            if (!e.hasClass("selected")) {
                if (modal.elem.find(".item.selected").length == 10)
                    return this.showMessage("warning", "Cannot select more than 10 items");
                e.addClass("selected");
                stotal += parseInt(e.data("price"), 10);
            }
            else {
                e.removeClass("selected");
                stotal -= parseInt(e.data("price"), 10);
            }

            //Update total
            modal.elem.data("selected-total", stotal);
            modal.elem.find(".to-value").html((stotal / 100).toFixed(2)).addClass('label-success');

            //Hints
            if (rValue) {
                modal.elem.find(".w-chances").html("--%");
                var imax = rValue * (1 + JOIN_MARGIN);
                var imin = rValue * (1 - JOIN_MARGIN);
                var toHint = modal.elem.find(".to-hint");
                var toValue = modal.elem.find(".to-value");
                toHint.css("font-size", "smaller");
                var rTxt = "";
                if (stotal > imax) {
                    rTxt = "+" + ((stotal - imax) / 100).toFixed(2);
                    rTxt += " Too high!";
                    toHint.css("color", "#d9534f");
                    toValue.removeClass('label-primary label-success').addClass('label-danger');
                }
                else if (stotal < imin && stotal != 0) {
                    rTxt = ((stotal - imin) / 100).toFixed(2);
                    rTxt += " Too low!";
                    toHint.css("color", "#6495ED");
                    toValue.removeClass('label-primary label-success').addClass('label-danger');
                }
                else if (stotal == 0) {
                    toValue.removeClass('label-success label-danger').addClass('label-primary');
                }
                else {
                    var wpt = 50 * (stotal / rValue);
                    modal.elem.find(".w-chances").html(wpt.toFixed(2) + "%");
                    //rTxt = "OK";
                    toHint.css("color", "#32CD32");
                    toValue.removeClass('label-primary label-danger').addClass('label-success');
                }
                toHint.html(rTxt);
            }
        });

        //Update suggested
        total += parseInt(elem.data("price"), 10);
    });

    modal.elem.find(".t-value").html((total / 100).toFixed(2));
    modal.elem.data("total", total);
    modal.elem.data("selected-total", 0);
};

function animateTextValue(elem, target) {
    if (elem.attr("data-value") == target)
        return;
    elem.animate(
        {value: target},
        {
            step: function (now) {
                $(this).html((now / 100).toFixed(2));
            },
            complete: function () {
                $(this).html((target / 100).toFixed(2));
                $(this).attr("data-value", target);
            },
            duration: 800,
            easing: "linear"
        }
    );
}

var DuelUI = {
    ctn: null,
    socket: null,
    inventory: null,
    inventoryDate: null,
    rtpl: null,

    init: function (ctn, socket) {
        this.ctn = ctn;
        this.socket = socket;
        this.rtpl = Handlebars.compile($("#tpl-r-duel").html());

        var self = this;
        this.ctn.find(".btn-create").on("click", function () {
            self.createRound();
        });
        this.ctn.find(".btn-history").on("click", function () {
            self.socket.emit("history");
        });

        setInterval(function () {
            self.updateUI();
        }, 1000);
    },

    updateUI: function () {
        var total = 0, yours = 0;
        $(".rounds .duel").each(function () {
            var val = parseInt($(this).data("tvalue"), 10);
            total += val;
            if ($(this).data("c-id") == window.Application.sid)
                yours += val;
        });

        animateTextValue($("#duel-game-ui .total"), total)
        var yCtn = $("#duel-game-ui .current-bets");
        if (yours) {
            animateTextValue(yCtn, yours)
            yCtn.html((yours / 100).toFixed(2));
        }
        else {
            yCtn.html("-");
            yCtn.data("value", 0);
        }
        $("#duel-game-ui .nbr-round").html($(".rounds .duel").length);
    },

    clearUI: function () {
        this.ctn.find(".rounds tbody").html("");
    },

    render: function (round) {
        var self = this;

        round.total_rvalue = round.c_value;
        round.join_min = (round.c_value * (1 - JOIN_MARGIN) / 100).toFixed(2);
        round.join_max = (round.c_value * (1 + JOIN_MARGIN) / 100).toFixed(2);
        round.fc_value = round.c_value / 100;
        round.c_items.forEach(function(i) {
            i.fprice = (i.price / 100).toFixed(2);
        });

        if(round.j_items) {
            var jtotal = 0;
            round.j_items.forEach(function(i) {
                i.fprice = (i.price / 100).toFixed(2);
                jtotal += i.price;
            });
            round.total_rvalue += jtotal;
        }

        round.total_rvalue = round.total_rvalue;

        round.total_frvalue = (round.total_rvalue / 100).toFixed(2);

        round.c_items_count = round.c_items.length;
        round.c_items_extra = (round.c_items.length > 5)
            ? round.c_items.length - 5
            : undefined;
        round.c_items = round.c_items.splice(0, 5);

        var elem = $(this.rtpl(round));
        //Decorate items
        var kn = /^â…/i;
        var st = /^StatTrak/i;
        var sv = /^Souvenir/i;
        elem.find(".item").each(function () {
            var e = $(this);
            var name = e.attr("title");
            if (kn.test(name))
                e.addClass("knife");
            else if (st.test(name))
                e.addClass("stattrak");
            else if (sv.test(name))
                e.addClass("souvenir");
            else if (parseInt(e.data("price"), 10) > 10000)
                e.addClass("hightier");
        });

        var sid = window.Application.sid;
        var jbtn = elem.find(".btn-join");
        if (sid != round.created_by.steam_id) {
            jbtn.on("click", function () {
                console.log(round.round_id);
                self.joinRound(round.round_id);
            });
        }
        else jbtn.prop("disabled", true);

        if (round.end_date)
            elem.find(".btn-join").remove();

        elem.find(".btn-details").on("click", function () {
            console.log("Requesting round details", round.round_id);
            self.socket.emit("getRound", round.round_id);
        });
        return elem;
    },

    appendRound: function (elem) {
        var rctn = (elem.data("c-id") == window.Application.sid)
            ? DuelUI.ctn.find(".rounds tbody.own")
            : DuelUI.ctn.find(".rounds tbody.others");

        var value = parseInt(elem.data("value"), 10);
        if (!rctn.find(".duel").length) {
            rctn.append(elem);
            setTimeout(function () {
                elem.addClass("in");
            }, 0);
            return;
        }

        rctn.find(".duel").each(function () {
            var rElem = $(this);
            var tval = parseInt(rElem.data("value"), 10);
            if (value > tval) {
                rElem.before(elem);
                return false;
            }
        });
        if (!rctn.find(elem).length) {
            rctn.append(elem);
        }
        setTimeout(function () {
            elem.addClass("in");
        }, 0);
        var rid = elem.data("rid");
        if ($('.duel-details [data-rid="' + rid + '"]').length)
            this.socket.emit("getRound", rid);
    },

    initTimer: function (elem, data) {
        if (!data.j_join_on) {
            elem.find(".duel-status").html('<span style="color: #2ecc71;">Open</span>');
            return;
        }

        var elapsed = Math.ceil(((data.now - data.j_join_on) / 1000));
        var delta = JOIN_TIME - elapsed;

        elem.find(".btn-join").prop("disabled", true).hide();
        var em = elem.find(".duel-status").html("");
        var d = $("<div></div>");
        em.append(d);
        d.countdown360({
            radius: 19,
            seconds: delta,
            strokeStyle: "#df4400",
            fillStyle: "#fe7234",
            fontColor: "#fff",
            strokeWidth: 4,
            fontSize: 12,
            smooth: true,
            label: [],
            autostart: true
        });
    },

    showDetails: function (data) {
        var self = this;
        var tpl = Handlebars.compile($("#tpl-duel-details").html());
        data.created_by.level = data.created_by.level ? data.created_by.level : 0;
        data.c_fvalue = (data.c_value / 100).toFixed(2);
        data.c_items.forEach(function (i) {
            i.fprice = (i.price / 100).toFixed(2);
        });
        data.c_odds = "--%";
        if (data.j_items) {
            data.joined_by.level = data.joined_by.level ? data.joined_by.level : 0;
            data.j_fvalue = (data.j_value / 100).toFixed(2);
            data.j_items.forEach(function (i) {
                i.fprice = (i.price / 100).toFixed(2);
            });

            var total = data.j_value + data.c_value;
            data.c_odds = (data.c_value * 100 / total).toFixed(2) + "%";
            data.j_odds = (data.j_value * 100 / total).toFixed(2) + "%";
        }


        var html = $(tpl(data));
        if (data.created_by.side == "ct") {
            html.find(".cblock .profile").addClass("ctside");
            html.find(".jblock .profile").addClass("tside");
        }
        else {
            html.find(".cblock .profile").addClass("tside");
            html.find(".jblock .profile").addClass("ctside");
        }

        //Level colors
        var style = getLevelClass(data.created_by.level);
        html.find(".cblock .p-level")
            .css("background-color", style.bg)
            .css("color", style.txt);
        if (data.joined_by) {
            style = getLevelClass(data.joined_by.level);
            html.find(".jblock .p-level")
                .css("background-color", style.bg)
                .css("color", style.txt);
        }

        var cmodal = $('.duel-details[data-rid="' + data.round_id + '"]');
        if (cmodal.length) {
            var e = cmodal.closest(".modal-body").html(html);
            return self.updateModal(e, data);
        }

        var m = new CModal();
        m.init({title: "Duel ID #" + data.round_id, altTheme: true, isConfirm: false, large: true});
        m.setContent(html);
        m.show();
        self.updateModal(m.elem, data);
    },

    updateModalWinner: function (modal, cwin, roll) {
        //The anim
        var cside = modal.find(".cblock").data("side");
        var wside = cwin ? cside : cside == "ct" ? "t" : "ct";

        var anim = $("<div></div>");
        modal.find(".duel-status").html(anim);
        anim.addClass("wanim wanim-" + wside);

        //The Highlight
        setTimeout(function () {
            if (cwin) {
                modal.find(".cblock").addClass("won");
                modal.find(".jblock").addClass("lost");
            }
            else {
                modal.find(".cblock").addClass("lost");
                modal.find(".jblock").addClass("won");
            }
            var rd = $("<p></p>");
            rd.addClass("text-center").html("Roll: " + roll);
            rd.css("font-size", "0.7em");
            modal.find(".dt-status").append(rd);
        }, 4300);
    },

    updateModal: function (modal, data) {
        switch (data.status) {
            case EDuelStatus.JOINING:
                DuelUI.initTimer(modal, data);
                break;
            case EDuelStatus.CLOSED:
            case EDuelStatus.SENT:
            case EDuelStatus.ACCEPTED:
                modal.find(".jblock .items").removeClass("hide-items");
                var ns = new Date(data.now);
                var ed = new Date(data.end_date);
                var d = ns.getTime() - ed.getTime();
                console.log("Delta on modal win:", d);
                var cwin = data.winner_id == data.created_by.steam_id;
                if (d > 8 * 1000)
                    return DuelUI.updateModalWinner(modal, cwin, data.roll);

                var dStatus = modal.find(".duel-status");
                dStatus.html("");
                var dd = $("<div></div>");
                dStatus.append(dd);
                dd.countdown360({
                    radius: 19,
                    seconds: 8 - Math.floor(d / 1000),
                    strokeStyle: "#049700",
                    fillStyle: "#05c100",
                    fontColor: "#fff",
                    strokeWidth: 4,
                    fontSize: 12,
                    smooth: true,
                    label: [],
                    autostart: true,
                    onComplete: function () {
                        DuelUI.updateModalWinner(modal, cwin, data.roll);
                    }
                });
        }
    },

    createRound: function () {
        if (!window.Application || !window.Application.sid)
            return document.location = "/auth";

        var self = this;
        var ipm = new ItemsPicker();
        ipm.setConfirmCallback(function (ids, seed, side, autocancel) {
            var modal = this.modal;
            modal.elem.find(".btn-send").button("loading");
            this.showMessage("info", "Creating round with seed <strong>" + seed + "</strong>... please wait.");

            setTimeout(function () {
                self.socket.emit("createRound", {
                    asset_ids: ids,
                    seed: seed,
                    side: side,
                    auto_cancel: autocancel
                });
            }, 2000);
            setTimeout(function () {
                modal.hide();
            }, 7000);
        });
    },

    joinRound: function (rid) {
        if (!window.Application || !window.Application.sid)
            return document.location = "/auth";

        var self = this;
        var roundElem = self.ctn.find('.duel[data-rid="' + rid + '"]');
        if (!roundElem.length) return console.log("invalid elem");
        if (roundElem.data("status") != EDuelStatus.OPEN)
            return console.log("invalid status");
        var val = parseInt(roundElem.data("value"), 10);

        var ipm = new ItemsPicker(val, roundElem.data("side"));
        ipm.modal.elem.find(".autocancel").parent().remove();
        ipm.setConfirmCallback(function (ids, seed) {
            var modal = this.modal;
            modal.elem.find(".btn-send").button("loading");
            this.showMessage("info", "Joining round with seed <strong>" + seed + "</strong>... please wait.");

            setTimeout(function () {
                self.socket.emit("joinRound", {
                    round_id: rid,
                    asset_ids: ids,
                    seed: seed
                });
            }, 5000);
            setTimeout(function () {
                modal.hide();
            }, 7000);
        });
    },

    closeRow: function (round, data) {
        var cid = round.data("c-id");
        var winner = cid == data.winner_id ? data.created_by : data.joined_by;
        var cside = data.created_by.side;
        var st = round.find(".duel-status");

        var wside;
        if (cid == data.winner_id) wside = cside + "-side";
        else wside = cside == "t" ? "ct-side" : "t-side";

        var h = '<div class="duel-winner ' + wside + '">';
        h += '<div class="c-profile-wrp wanim-row"><img src="' + winner.avatar + '"/>';
        h += '</div></div>';
        st.html(h);
        setTimeout(function () {
            round.removeClass("in").addClass("out");
            setTimeout(function () {
                round.remove();
            }, 1250);
        }, 70000);
    },

    closeRound: function (data) {
        var self = this;
        var rid = data.round_id;
        var wid = data.winner_id;
        var round = DuelUI.ctn.find('.duel[data-rid="' + rid + '"]');
        if (!round.length) return console.log("Failed to close, round element doesn't exists.");

        var cid = round.data("c-id");

        round.find(".btn-join").prop("disabled", true);
        var st = round.find(".duel-status");
        var d = $('<div class="subanim"></div>');
        st.html("");
        st.append(d);
        st.find(".subanim").countdown360({
            radius: 19,
            seconds: 10,
            strokeStyle: "#049700",
            fillStyle: "#05c100",
            fontColor: "#fff",
            strokeWidth: 4,
            fontSize: 12,
            smooth: true,
            label: [],
            autoStart: true,
            onComplete: function () {
                self.closeRow(round, data);
            }
        });

        //On details
        var modal = $('.duel-details[data-rid="' + rid + '"]');
        if (!modal.length) return;
        var dStatus = modal.find(".duel-status");
        dStatus.html("");
        modal.find(".jblock .items").removeClass("hide-items");
        var dd = $('<div class="subanim"></div>');
        dStatus.append(dd);
        dStatus.find(".subanim").countdown360({
            radius: 19,
            seconds: 8,
            strokeStyle: "#049700",
            fillStyle: "#05c100",
            fontColor: "#fff",
            strokeWidth: 4,
            fontSize: 12,
            smooth: true,
            label: [],
            autostart: true,
            onComplete: function () {
                DuelUI.updateModalWinner(modal, cid == wid, data.roll);
            }
        });
    },

    hide: function () {
        this.ctn.hide();
    },
    show: function () {
        this.ctn.show();
    }
};

$(function () {
    //var socket = io("//csh-duel-pubg.herokuapp.com/realtime");
    var socket = io("//coinfliphunt.baterka.xyz");
    var statusLine = $("#socket-status");

    DuelUI.init($("#duel-game-ui"), socket);

    socket.on('connect_error', function () {
        DuelUI.clearUI();
        DuelUI.hide();
        statusLine.attr("class", "alert alert-warning")
            .html("Connection failed")
            .show();
    });
    socket.on('reconnect_failed', function () {
        DuelUI.clearUI();
        DuelUI.hide();
        $("#message").attr("class", "alert alert-warning")
            .html("Reconnect failed")
            .show();
    });

    socket.on("connected", function (data) {
        console.log("connected");
        console.log(data);
        statusLine.hide();
        DuelUI.clearUI();
        DuelUI.show();
        data.rounds.forEach(function (round) {
            var elem = DuelUI.render(round);
            DuelUI.appendRound(elem);
            if (round.end_date) {
                DuelUI.closeRow(elem, round);
                //console.log("Rendering closed round", round._id);
                console.log("Rendering closed round", round.round_id);
                return;
            }

            DuelUI.initTimer(elem, round);
        });
        DuelUI.ctn.find(".item").tooltip();

        var uData = window.Application;
        if (!uData.stk) return;
        socket.emit("authenticate", {stk: uData.stk, sid: uData.sid});
        socket.emit("getMVP");
    });

    socket.on("newRound", function (data) {
        console.log("newRound");
        console.log(data);
        var e = DuelUI.render(data);
        DuelUI.appendRound(e);
        e.find(".item").tooltip();
        DuelUI.initTimer(e, data);
    });

    socket.on("refresh", function (data) {
        console.log("refresh");
        console.log(data);
        DuelUI.clearUI();
        data.rounds.forEach(function (round) {
            var r = DuelUI.render(round);
            DuelUI.appendRound(r);
            DuelUI.initTimer(r, round);
        });
        DuelUI.ctn.find(".item").tooltip();
    });

    /*socket.on("mvp", function(data) {
        console.log("mvp");
        console.log(data);
        var mvp = DuelUI.ctn.find(".live-info .mvp");
        var tpl = Handlebars.compile($("#mvp-tpl").html());

        data.name = data.name.replace(/(?!csgohunt\.com)csgo\w*\.\w*|csgo\w*\. \w*|csgo\w* \.\w*|csgo\w* \. \w*|csgo-\w*\.\w*|skinarena|failsnipe|csgoshuffle|skinsrate|ezskins\.com|loveskins\.gq|skinrush\.net|csgorigged\!com|skinsgambling\.com|www\.dotajackpots\.com/ig, "");
        if(data.name.length > 16)
            data.name = data.name.substr(0, 16) + "...";

        data.total = data.total / 100;
        mvp.html(tpl(data));
        mvp.find("div").tooltip();
    });*/

    socket.on("removeDuel", function (data) {
        console.log("removeDuel");
        console.log(data);
        DuelUI.ctn.find('.duel[data-rid="' + data + '"]').fadeOut(function () {
            $(this).remove();
        });
    });

    socket.on("gameError", function (error) {
        alert(error);
    });

    socket.on("onCreateResult", function (data) {
        console.log("onCreateResult");
        console.log(data);
        var modal = new CModal();
        if (data.error) {
            modal.init({
                title: "Failed to create offer",
                content: data.error,
                altTheme: true,
                isConfirm: false
            });
            modal.show();
            return;
        }

        modal.init({
            title: "Offer sent!",
            isConfirm: false,
            altTheme: true
        });

        var msg = "Your trade offer has been sent with the code ";
        msg += '<strong>' + data.pin + '</strong>. You have 2 minutes to accept it!';
        msg += '<br /><a class="btn btn-info steam-link" href="https://steamcommunity.com/tradeoffer/' + data.tradeofferid + '" target="_blank">';
        msg += '<i class="fa fa-external-link"></i> Open the trade';
        msg += '</a>';
        modal.setContent(msg);
        modal.elem.attr("data-coffer-id", data.tradeofferid);
        modal.show();
    });

    socket.on("onJoinResult", function (data) {
        console.log("onJoinResult");
        console.log(data);
        var modal = new CModal();
        if (data.error) {
            modal.init({
                title: "Failed to create offer",
                content: data.error,
                altTheme: true,
                isConfirm: false
            });
            modal.show();
            return;
        }

        modal.init({
            title: "Offer sent!",
            isConfirm: false,
            altTheme: true
        });

        var msg = "Your trade offer has been sent with the code ";
        msg += '<strong>' + data.pin + '</strong>. You have 2 minutes to accept it!';
        msg += '<br /><a class="btn btn-info steam-link" href="https://steamcommunity.com/tradeoffer/' + data.tradeofferid + '" target="_blank">';
        msg += '<i class="fa fa-external-link"></i> Open the trade';
        msg += '</a>';
        modal.setContent(msg);
        modal.elem.attr("data-joffer-id", data.tradeofferid);
        modal.show();
    });

    socket.on("onJoinOfferUpdate", function (data) {
        console.log("onJoinOfferUpdate");
        console.log(data);
        var modal = $('.modal[data-joffer-id="' + data.tradeofferid + '"]');
        if (!modal.length)
            return;

        if (data.accepted)
            modal.find(".modal-body").html("Offer accepted!");
        else modal.find(".modal-body").html("Offer declined: " + data.error);
    });

    socket.on("onCreateOfferUpdate", function (data) {
        console.log("onCreateOfferUpdate");
        console.log(data);
        var modal = $('.modal[data-coffer-id="' + data.tradeofferid + '"]');
        if (!modal.length)
            return;

        if (data.accepted)
            modal.find(".modal-body").html("Offer accepted!");
        else modal.find(".modal-body").html("Offer declined: " + data.error);
    });

    //Free
    socket.on("roundJoiningP0", function (rid) {
        console.log("Round free ", rid);
        var e = $('.duel[data-rid="' + rid + '"]');
        if (!e) return socket.emit("refresh");

        var value = parseInt(e.data("value"));
        e.data("status", 1);
        e.find(".r-value").html((value / 100).toFixed(2));
        e.find(".j-profile, .j-items").html("");
        e.find(".d-opponent").html("");

        e.find(".duel-status").html('<span style="color: #2ecc71;">Open</span>');
        if (!window.Application.sid || e.data("cid") != window.Application.sid)
            e.find(".btn-join").prop("disabled", false).show();

        var dmodal = $('.duel-details[data-rid="' + rid + '"]');
        if (dmodal.length) {
            dmodal.find(".jblock").html("");
            dmodal.find(".duel-status").html("");
        }
    });

    socket.on("roundJoiningP1", function (data) {
        console.log("roundJoiningP1");
        console.log(data);
        var e = $('.duel[data-rid="' + data.round_id + '"]');
        if (!e.length) return socket.emit("refresh");

        var elem = DuelUI.render(data);
        elem.addClass("in");
        e.replaceWith(elem);

        elem.find(".item").tooltip();
        elem.find(".btn-join").prop("disabled", true).hide();

        var em = elem.find(".duel-status");
        var d = $("<div></div>");
        em.append(d);
        d.countdown360({
            radius: 19,
            seconds: JOIN_TIME,
            strokeStyle: "#df4400",
            fillStyle: "#fe7234",
            fontColor: "#fff",
            strokeWidth: 4,
            fontSize: 12,
            smooth: true,
            label: [],
            autostart: true
        });

        if ($('.duel-details[data-rid="' + data.round_id + '"]').length)
            DuelUI.showDetails(data);
    });

    socket.on("showDetails", function (data) {
        console.log("showDetails");
        console.log(data);
        console.log("Got round details", data.round_id);
        DuelUI.showDetails(data);
    });

    socket.on("roundEnd", function (data) {
        console.log("roundEnd");
        console.log(data);
        DuelUI.closeRound(data);
    });

    socket.on("history", function (data) {
        console.log("history");
        console.log(data);
        var modal = new CModal();
        modal.init({
            title: "Last 50 rounds",
            altTheme: true,
            isConfirm: false,
            large: true
        });

        var tpl = Handlebars.compile($("#tpl-history").html());
        var row = Handlebars.compile($("#tpl-history-row").html());
        if (data && data.length) {
            var html = $(tpl({}));
            var body = html.find("tbody");
            data.forEach(function (round) {
                round.total = ((round.c_value + round.j_value) / 100).toFixed(2);
                round.winner = round.winner_id == round.created_by.steam_id ?
                    round.created_by : round.joined_by;

                if (round.winner_id == round.created_by.steam_id)
                    round.winner_side = round.created_by.side;
                else round.winner_side = round.created_by.side == "t" ? "ct" : "t";

                var h = $(row(round));
                h.find(".btn-replay").on("click", function () {
                    socket.emit("getRound", $(this).closest("tr").data("rid"));
                });
                body.append(h);
            });

            modal.setContent(html);
        }
        else {
            modal.setContent("No history");
        }

        modal.show();
    });

    socket.on("win", function (data) {
        console.log("win");
        console.log(data);
        var cmodal = new CModal();
        var msg = "Congratulation! You won a round valued at ";
        msg += (data.value / 100).toFixed(2);
        msg += ". You will soon receive an offer with the confirmation code ";
        msg += "'" + data.pin + "'";
        cmodal.init({
            title: "You won!",
            content: msg,
            altTheme: true,
            isConfirm: false
        });
        cmodal.elem.find(".modal-dialog").removeClass("modal-lg");
        cmodal.show();
    });
});

$(function () {
    setTimeout(function () {
        askTradeurl();
    }, 3000);
})