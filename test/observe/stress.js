/**
 * Created by David on 3/12/2016.
 */

function stress_functions() {

    function partials_path() {

        var path = window.location.toString();
        return path.replace(/\/test\/observe\/\w+.html/g,'/lib/partials/');
    }

    document.getElementById('preauth').addEventListener('click', function(evt) {

        Rdbhost.connect('dev.rdbhost.com', 14, partials_path());
        var preauth = Rdbhost.preauth();

        var p = preauth.query('SELECT 123; \n\n SELECT \'abc\'; UPDATE whatever SET a=1;\n\nINSERT INTO wherever (b) VALUES(2);').get_data();
        p.catch(function(e) {
            // alert(e);
        });

        evt.stopImmediatePropagation();
        evt.preventDefault();
    });

    document.getElementById('auth').addEventListener('click', function(evt) {

        Rdbhost.connect('dev.rdbhost.com', 14, partials_path());
        var auth = Rdbhost.auth();

        var p = auth.query('SELECT 123; \n\n SELECT \'abc\';').get_data();
        p.catch(function(e) {
            1 == 2;
            // alert(e);
        });

        evt.stopImmediatePropagation();
        evt.preventDefault();
    });

    document.getElementById('super').addEventListener('click', function(evt) {

        Rdbhost.connect('dev.rdbhost.com', 14, partials_path());
        var spr = Rdbhost.super();

        var p = spr.query('SELECT 123; \n\n SELECT \'abc\'; UPDATE whatever SET a=1;\n\nINSERT INTO wherever (b) VALUES(2);').get_data();
        p.catch(function(e) {
            // alert(e);
        });

        evt.stopImmediatePropagation();
        evt.preventDefault();
    });

    document.getElementById('credit').addEventListener('click', function(evt) {

        Rdbhost.connect('dev.rdbhost.com', 14, partials_path());

        var p = Rdbhost.show_form('apikey', function() {}, function() {}, {});
        p.catch(function(e) {
            // alert(e);
        });

        evt.stopImmediatePropagation();
        evt.preventDefault();
    });

    document.getElementById('confirm').addEventListener('click', function(evt) {

        Rdbhost.paranoid_confirm = true;

        Rdbhost.connect('dev.rdbhost.com', 14, partials_path());
        var spr = Rdbhost.super('fake-authcode');

        var p = spr.query('SELECT 123; \n\n SELECT \'abc\';').get_data();
        p.catch(function(e) {
                alert(e);
            })
            .then(function() {
                Rdbhost.paranoid_confirm = false;
            });

        evt.stopImmediatePropagation();
        evt.preventDefault();
    })

}
