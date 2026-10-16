const test = require('node:test')
const assert = require('node:assert/strict')
const {EventEmitter} = require('node:events')
const {install} = require('../app/assets/js/console-pipe')

test('closed launch terminal does not crash the GUI; other errors still surface', () => {
    const stream = new EventEmitter()
    install([stream])
    install([stream])
    assert.equal(stream.listenerCount('error'), 1)
    assert.doesNotThrow(() => stream.emit('error', Object.assign(new Error('broken pipe'), {code:'EPIPE'})))
    const failure = Object.assign(new Error('unexpected I/O failure'), {code:'EIO'})
    assert.throws(() => stream.emit('error', failure), error => error === failure)
})
