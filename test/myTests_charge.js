
/*
*
* tests for the SQLEngine
*
*
*/
module('Charge tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
    },
    teardown: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// create connection
asyncTest('charge event', function() {

    Rdbhost.connect(domain, acct_number);
    var pa = Rdbhost.preauth();
    ok(pa, 'connection created');
    // ok('authCode' in pa, 'conn has authCode attribute ');
    ok(pa.role === 'preauth', 'role is preauth ');

    pa.charge();

});

/*
*
*/
