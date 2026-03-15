import * as readline from 'node:readline'

export function promptInput(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

export function promptSecret(message: string): Promise<string> {
  return new Promise((resolve) => {
    let input = ''

    process.stdout.write(message)

    if (typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    const onData = (data: string) => {
      for (const char of data) {
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            cleanup()
            process.stdout.write('\n')
            resolve(input)
            return
          case '\u0003': // Ctrl+C
            cleanup()
            process.stdout.write('\n')
            process.exit(1)
            return
          case '\u007F': // Backspace
          case '\b':
            if (input.length > 0) {
              input = input.slice(0, -1)
              process.stdout.write('\b \b')
            }
            break
          default:
            input += char
            process.stdout.write('*')
            break
        }
      }
    }

    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
    }

    process.stdin.on('data', onData)
  })
}
