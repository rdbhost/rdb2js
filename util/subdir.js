/**
 * Created by David on 3/26/2017.
 */


var $L = $LAB
    .script('//dev.rdbhost.com/vendor/rdbhost/latest/lib/js/util-bundle;rdbhost.js').wait(
        function() {

            if ( !Rdbhost.featuredetects.hasPromises() )
                $L = $L.script('//dev.rdbhost.com/vendor/rdbhost/2.1/vendor/es6-promises/dist/es6-promise.js');
            if ( !Rdbhost.featuredetects.hasFetch() )
                $L = $L.script('//dev.rdbhost.com/vendor/rdbhost/2.1/vendor/fetch/fetch.js').wait();
        }
    );


function list_dir(host, acct, container, path) {

    var prefix='',
        i0, parentDir,
        templateContainer, templateRow;

    path = path || window.location.pathname;

    templateContainer = container.getElementsByTagName('ul')[0];
    templateRow = templateContainer.getElementsByTagName('li')[0];
    templateContainer.removeChild(templateRow);

    Rdbhost.connect(host, acct);

    if (path.indexOf('/vendor/rdbhost/') > -1) {

        path = path.replace('/vendor/rdbhost/', '/');
        prefix = '/vendor/rdbhost'
    }

    if (path.length > 2) {

        parentDir = path.split('/');
        parentDir.splice(-2,2);
        parentDir = parentDir.join('/') + '/';
        i0 = templateRow.cloneNode(true);
        i0.innerHTML = templateRow.innerHTML.replace('{name}', '..').replace('{link}', prefix + parentDir);
        templateContainer.appendChild(i0);
    }

    var p = Rdbhost.preauth()
        .query('SELECT name, isdir FROM subdir(%s);')
        .params([path])
        .get_data();

    p.then(function(d) {
        var rows = d.result_sets[0].records.rows;
        _.each(rows, function(r) {

            if (r.name === '')
                return;
            if (r.isdir)
                r.name = r.name + '/';

            i0 = templateRow.cloneNode(true);

            i0.innerHTML = templateRow.innerHTML.replace('{name}', r.name).replace('{link}', prefix + path + r.name);
            templateContainer.appendChild(i0);
        });

    })
    .catch(function(e) {
        throw e;
    })
}

