/**
 * Created by David on 1/4/2016.
 */

var $L = $LAB
    .script('/lib/js/rdbhost-bundle.js').wait(function() {

        if ( !Rdbhost.featuredetects.hasPromises() )
            $L = $L.script('/vendor/es6-promises/dist/es6-promise.js');
        if ( !Rdbhost.featuredetects.hasFetch() )
            $L = $L.script('/vendor/fetch/fetch.js');
    })
    .script('/lib/js/rdbhost_livereload.js');


