function CModal() {
    this.tpl = Handlebars.compile($("#tpl-cmodal").html());
    this.elem = null;
    this.options = {
        isConfirm: true,
        altTheme: false,
        large: false,
        confirmCallback: null,
        closeCallback: null,
        closeOnConfirm: true,
        confirmLabel: "Confirm",
        closeLabel: "Cancel",
        bs_options: {}
    };
}

CModal.prototype.init = function (options) {
    var self = this;
    var html = this.tpl({title: options.title, message: options.content});
    jQuery.extend(self.options, options);
    self.elem = $(html);
    if (options.altTheme)
        self.elem.addClass("modal-alt");
    if (options.large)
        self.elem.find(".modal-dialog").addClass("modal-lg");
    self.elem.find(".btn-cancel").html(options.closeLabel);
    if (self.options.isConfirm || self.options.confirmCallback) {
        self.options.isConfirm = true;
        var cBtn = self.elem.find(".modal-footer .btn-confirm");
        cBtn.html(self.options.confirmLabel);
        cBtn.on("click", function (e) {
            if (self.options.closeOnConfirm)
                self.elem.modal('hide');
            options.confirmCallback && options.confirmCallback();
        });
    }
    else {
        self.elem.find(".btn-cancel").html("Close");
        self.elem.find(".btn-confirm").remove();
    }
    self.elem.on("shown.bs.modal", function (e) {
        if (options.shownCallback)
            options.shownCallback(e);
    });
    self.elem.find(".modal-footer .btn-cancel").on("click", function (e) {
        self.elem.modal('hide');
        options.closeCallback && options.closeCallback();
    });
    self.elem.on("hidden.bs.modal", function (e) {
        self.destroy();
    });
    return this;
};
CModal.prototype.setContent = function (html) {
    this.elem.find(".modal-body").html(html);
};
CModal.prototype.show = function () {
    this.elem.modal(this.options.bs_options);
    this.elem.modal('show');
};
CModal.prototype.hide = function () {
    this.elem.modal('hide');
};
CModal.prototype.destroy = function () {
    this.elem.remove();
};