
PASSWORD = undefined;

function get_password() {

    if ( ! PASSWORD )
        PASSWORD = prompt('password');
    return PASSWORD;
}

var SETUP_OK = false;

module('Charge tests', {

    beforeEach: function (assert) {
        // console.log('beforeEach');
        SETUP_OK = true;
        var done = assert.async();
        Rdbhost.connect(domain, acct_number);
        get_password();
        done();
    },
    afterEach: function(assert) {
        // console.log('afterEach');
        SETUP_OK = false;
        var done = assert.async();
        Rdbhost.once('connection-closed:super', function() {
            done();
        });
        Rdbhost.disconnect(1000, '');
    }
});

// create connection
QUnit.test('charge event', function(assert) {

    var done = assert.async();

    ok(SETUP_OK,'setup ok');
    Rdbhost.connect(domain, acct_number);
    var p = Rdbhost.super()
            // .form_data(new FormData())
            .query("SELECT 1 AS amount, 'test' AS description, 'me' AS idx;")
            .charge('1234123412341234', '', '11', '2018');

    p.then(function(d) {
            ok(true, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'catch called');
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        ok(frm.textContent.indexOf('SELECT 1 AS') >= 0, 'sql found');

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 500);

    var st = setTimeout(function() {
        done();
    }, 1000);
});

/*
*
*/
