
/*
*
* tests for the SQLEngine
*
*
*/

PASSWORD = undefined;

function get_password() {

    if ( ! PASSWORD )
        PASSWORD = 'horosh00'; //prompt('password');
    return PASSWORD;
}

module('Authorization tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
        get_password();
    },
    teardown: function() {
        QUnit.stop();
        Rdbhost.once('connection-closed:super', function() {
            QUnit.start()
        });
        Rdbhost.disconnect(1000, '');
    }
});

// send super request, cancel authorization dialog
//
asyncTest('super request cancel', 4, function() {

    var e = Rdbhost.super()
                   .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        ok(frm.innerText.indexOf('SELECT 1') >= 0, 'sql found');
        cncl.click();
    }, 1500);

    var st = setTimeout(function() { start(); }, 5000);
});


// send super request, confirm with authorization dialog
//
asyncTest('super request confirm', 4, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === 1, d.status);
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        ok(frm.innerText.indexOf('SELECT 1 AS a') >= 0, 'sql found');

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 1500);

    var st = setTimeout(function() { start(); }, 5000);
});


// send super request, confirm with authorization dialog
//
asyncTest('super request http confirm', 3, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === 1, d.status);
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 1500);

    var st = setTimeout(function() { start(); }, 5000);
});



// send super request, confirm with authorization dialog
//
asyncTest('super request http cancel', 3, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 1500);

    var st = setTimeout(function() { start(); }, 5000);
});


module('modal-force tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
        get_password();

        Rdbhost.clickrecd = [];
        Rdbhost.clicktried = [];
        function oclick(evt) {
            Rdbhost.clickrecd.push(evt);
        }

        // add an a tag to page
        var el = document.createElement('a'),
            href = document.createAttribute('href'),
            id = document.createAttribute('id');
        href.value = '#';
        id.value = 'test-link';
        el.setAttributeNode(href);
        el.setAttributeNode(id);
        el.addEventListener('click', oclick);

        document.body.appendChild(el);

    },
    teardown: function() {
        QUnit.stop();
        Rdbhost.once('connection-closed:super', function() {
            QUnit.start()
        });
        Rdbhost.disconnect(1000, '');
        var el = document.getElementById('test-link');
        document.body.removeChild(el);
        delete Rdbhost.clickrecd;
        delete Rdbhost.clicktried;
    }
});

// send super request, cancel authorization dialog
//
asyncTest('super request modal', 4, function() {

    var el = document.getElementById('test-link');
    el.click();
    Rdbhost.clicktried.push(1);

    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            clearTimeout(st);
            ok(Rdbhost.clickrecd.length === 1, 'wrong number clicks '+Rdbhost.clickrecd.length);
            ok(Rdbhost.clicktried.length === 2, 'wrong number click tries '+Rdbhost.clicktried.length);
            start();
        });

    setTimeout(function() {
        el.click();
        Rdbhost.clicktried.push(1);
    }, 1500);
    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 1800);

    var st = setTimeout(function() { start(); }, 5000);
});




/*
*
*/
