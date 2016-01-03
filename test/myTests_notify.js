

module('Notify tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
    },
    teardown: function() {
        Rdbhost.disconnect(1000, '');
    }
});




// send reader request with query, verify promise fulfilled
//
asyncTest('listen request ok', 4, function() {

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1])
        .listen('abc');

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].records.rows[0].a == 1, 'column value === 1');
            clearTimeout(st);
            start();
      })
      .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
      });

    var st = setTimeout(function() { start(); }, 1000);
});


// send reader listen request with query, verify promise fulfilled
//    and that notify is independently received
//
asyncTest('listen request receives ok', 7, function() {

    var notifyrecd = false;

    Rdbhost.once('notify-received:abc', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'abc', 'channel is correct');
        ok(pl.substr(0,6) === 'test m', 'payload is correct');
        notifyrecd = true;
    });

    var r = Rdbhost.reader()
        .query("NOTIFY \"abc\", 'test message on channel abc';")
        .listen('abc');

    var p = r.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd ) {
                clearTimeout(st);
                start();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 1000);
});


// send reader listen request with query, verify promise fulfilled
//    and that notify is independently received
//
asyncTest('listen request receives ftp-channel message ok', 7, function() {

    var notifyrecd = false;

    Rdbhost.once('notify-received:rdbhost_ftp_channel', function f(ch, pl) {
        ok(fail, 'notify-received should not be received');
    });
    Rdbhost.once('reload-request:rdbhost_ftp_channel', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'rdbhost_ftp_channel', 'channel is correct');
        ok(pl.substr(0,6) === 'test m', 'payload is correct');
        notifyrecd = true;
    });

    var r = Rdbhost.reader()
        .query("NOTIFY \"rdbhost_ftp_channel\", 'test message on channel abc';")
        .listen('rdbhost_ftp_channel');

    var p = r.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd ) {
                clearTimeout(st);
                start();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 1000);
});



/*
*
*/
