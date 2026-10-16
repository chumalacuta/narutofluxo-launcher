// A GUI launcher can outlive the terminal that started it. Only a closed
// console pipe is harmless; other stream errors must remain visible.
function handlePipeError(error) {
    if (error.code !== 'EPIPE') throw error
}

exports.install = function(streams = [process.stdout, process.stderr]) {
    for (const stream of streams) {
        if (stream && !stream.listeners('error').includes(handlePipeError)) {
            stream.on('error', handlePipeError)
        }
    }
}
