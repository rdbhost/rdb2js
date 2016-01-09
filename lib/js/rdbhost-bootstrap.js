/**
 * Created by David on 1/4/2016.
 */

function hasPromises() {
    var e = window;
    return "Promise" in e &&
        "resolve" in e.Promise && "reject" in e.Promise &&
        "all" in e.Promise && "race" in e.Promise &&
        function () {
            var n; new e.Promise(function (e) { n = e });
            return "function" == typeof n;
        }()
}
function hasFetch() { return "fetch" in window; }

var $L = $LAB
    .script('/lib/js/rdbhost-bundle.js').wait()
    .script('/lib/js/rdbhost_livereload.js');

if ( !hasPromises() )
    $L = $L.script('/vendor/es6-promises/dist/es6-promise.js');
if ( !hasFetch() )
    $L = $L.script('/vendor/fetch/fetch.js');

