
var domain, acct_number, demo_email,
    PASSWORD = undefined;

function get_password() {

    if ( ! PASSWORD )
        PASSWORD = private.getItem('demo_pass');
    return PASSWORD;
}

QUnit.module('Authorization tests', {

    beforeEach: function (assert) {
        console.log('beforeEach');
        var done = assert.async();
        domain = private.getItem('domain');
        acct_number = parseInt(private.getItem('acct_number'), 10);
        demo_email = private.getItem('demo_email');
        Rdbhost.connect(domain, acct_number);
        done();
    },
    afterEach: function(assert) {
        console.log('afterEach');
        var done = assert.async();
        Rdbhost.once('connection-closed:super', function() {
            done();
        });
        Rdbhost.disconnect(1000, '');
    }
});

// send super request, cancel authorization dialog
//
QUnit.test('super request cancel', function(assert) {

    console.log('test super req cancel');
    var done = assert.async();
    var e = Rdbhost.super()
                   .query('SELECT 1 AS a;');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        ok(frm.textContent.indexOf('SELECT 1') >= 0, 'sql found');
        cncl.click();
    }, 500);

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, confirm with authorization dialog
//
QUnit.test('super request confirm', function(assert) {

    console.log('test super req confirm');
    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS b');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].b === 1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        ok(frm.textContent.indexOf('SELECT 1 AS b') >= 0, 'sql found');

        eml.value = demo_email;
        pw.value =  private.getItem('demo_pass');
        sub.click();
    }, 500);

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, confirm with authorization dialog
//
QUnit.test('super request http confirm', function(assert) {

    console.log('test super req http confirm');
    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS c;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].c === 1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value =  private.getItem('demo_pass');
        sub.click();
    }, 500);

    var st = setTimeout(function() { done(); }, 5000);
});



// send super request, confirm with authorization dialog
//
QUnit.test('super request http cancel', function(assert) {

    console.log('test super req http cancel');

    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS d;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 500);

    var st = setTimeout(function() { done(); }, 5000);
});


QUnit.module('modal-force tests', {

    beforeEach: function (assert) {

        console.log('beforeEach 1');
        Rdbhost.connect(domain, acct_number);
        // get_password();

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
    afterEach: function(assert) {

        console.log('afterEach 1');
        var done = assert.async();
        Rdbhost.once('connection-closed:super', function() {
            done();
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
QUnit.test('super request modal', function(assert) {

    console.log('test super req modal');

    var el = document.getElementById('test-link');
    el.click();
    Rdbhost.clicktried.push(1);

    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS e');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            clearTimeout(st);
            ok(Rdbhost.clickrecd.length === 1, 'wrong number clicks '+Rdbhost.clickrecd.length);
            ok(Rdbhost.clicktried.length === 2, 'wrong number click tries '+Rdbhost.clicktried.length);
            done();
        });

    setTimeout(function() {
        el.click();
        Rdbhost.clicktried.push(1);
    }, 500);
    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 800);

    var st = setTimeout(function() { done(); }, 5000);
});




/*
*
*/
