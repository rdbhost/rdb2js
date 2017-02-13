
(function(window) {

    function hasPromises() {
        var e = window;
        return "Promise" in e &&
            "resolve" in e.Promise && "reject" in e.Promise &&
            "all" in e.Promise && "race" in e.Promise &&
            function () {
                var n;
                new e.Promise(function (e) {
                    n = e
                });
                return "function" == typeof n;
            }()
    }

    function hasFetch() {
        return "fetch" in window;
    }


    window.Rdbhost = _.extend(window.Rdbhost || {}, {

        featuredetects: {
            hasPromises: hasPromises,
            hasFetch: hasFetch
        }
    })
})(window);

