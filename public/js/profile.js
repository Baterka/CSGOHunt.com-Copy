$(function () {
    $("#save-profile-btn").on("click", function () {
        var req = $.ajax({method: "POST", url: "/api/update-profile", dataType: "json", data: {tradeurl: $("#trade-url").val(), _csrf: $("#csrf").val()}});
        req.done(function (resp) {
            $(".profile-form .alert").remove();
            if (resp.result) {
                $(".profile-form").prepend('<div class="alert alert-success">Profile saved.</div>');
            }
            else {
                $(".profile-form").prepend('<div class="alert alert-danger">' + resp.message + '</div>');
            }
            setTimeout(function () {
                $(".profile-form .alert").fadeOut(function () {
                    this.remove();
                });
            }, 10000);
        });
        req.fail(function (jqXHR, textStatus) {
            console.log(jqXHR)
        });
    });
});